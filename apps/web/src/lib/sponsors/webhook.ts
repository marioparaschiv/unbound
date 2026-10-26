import { createHmac, timingSafeEqual } from 'node:crypto';
import { createLogger } from '@unbound-app/logger';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import type { SponsorshipLifecycle, SponsorshipValues } from '~/lib/sponsors/sponsorships';
import { sponsorship, sponsorWebhookDelivery } from '~/db/schema';
import { upsertSponsorship } from '~/lib/sponsors/sponsorships';
import type { Sponsorship } from '~/lib/sponsors/standing';
import type { AppContext } from '~/lib/context';

const logger = createLogger('Web', 'Sponsors');

const MAX_BODY_BYTES = 1024 * 1024;

const SIGNATURE_PREFIX = 'sha256=';

const isoDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const sponsorshipActionSchema = z.enum([
	'created',
	'cancelled',
	'edited',
	'tier_changed',
	'pending_cancellation',
	'pending_tier_change',
]);

const githubAccountSchema = z.object({
	login: z.string(),
	id: z.union([z.int(), z.string()]).transform(String),
});

const payloadSchema = z.object({
	action: z.string(),
	effective_date: isoDate.optional(),
	sponsorship: z.object({
		created_at: isoDate,
		sponsorable: githubAccountSchema,
		sponsor: githubAccountSchema.nullable(),
		tier: z.object({
			name: z.string(),
			monthly_price_in_cents: z.int().nonnegative(),
			is_one_time: z.boolean(),
		}),
	}),
});

type SponsorshipAction = z.infer<typeof sponsorshipActionSchema>;

type SponsorshipEvent = {
	values: SponsorshipValues;
	effectiveDate: Date | undefined;
};

type Transition = (
	event: SponsorshipEvent,
	current: Sponsorship | undefined,
	now: Date,
) => SponsorshipLifecycle | undefined;

export type WebhookStatus = 'applied' | 'unchanged' | 'duplicate' | 'ignored';

function keepState(_event: SponsorshipEvent, current: Sponsorship | undefined) {
	return { state: current?.state ?? 'active', endsAt: current?.endsAt ?? null };
}

// Delivery ids stop replays, not reordering: a `created` older than a stored cancellation is stale.
function isStaleCreation(event: SponsorshipEvent, current: Sponsorship | undefined): boolean {
	return current?.state === 'cancelled' && event.values.since <= current.since;
}

const TRANSITIONS: Record<SponsorshipAction, Transition> = {
	created: (event, current) => {
		if (isStaleCreation(event, current)) return;

		return { state: 'active', endsAt: null };
	},
	edited: keepState,
	tier_changed: keepState,
	pending_cancellation: (event, current, now) => {
		if (current?.state === 'cancelled') return;

		return { state: 'pending_cancellation', endsAt: event.effectiveDate ?? now };
	},
	cancelled: (_event, current, now) => ({
		state: 'cancelled',
		endsAt: current?.endsAt && current.endsAt < now ? current.endsAt : now,
	}),
	pending_tier_change: () => undefined,
};

function status(value: WebhookStatus, code: number = 200): Response {
	return Response.json({ status: value }, { status: code });
}

function isSponsorshipAction(action: string): action is SponsorshipAction {
	return sponsorshipActionSchema.safeParse(action).success;
}

// UNKNOWN: the parsed body, validated by the payload schema next.
function parseJson(body: Uint8Array): unknown {
	try {
		return JSON.parse(new TextDecoder().decode(body));
	} catch {
		return undefined;
	}
}

/**
 * @description Checks GitHub's `X-Hub-Signature-256` header against the HMAC-SHA256 of the raw body.
 * @param secret The webhook secret.
 * @param body The raw request body.
 * @param header The header value, `sha256=<hex>`.
 * @returns Whether the signature is present and matches.
 */
export function verifySignature(secret: string, body: Uint8Array, header: string | null): boolean {
	if (!header?.startsWith(SIGNATURE_PREFIX)) {
		return false;
	}

	const signature = header.slice(SIGNATURE_PREFIX.length);

	if (!/^[0-9a-f]{64}$/i.test(signature)) {
		return false;
	}

	const expected = createHmac('sha256', secret).update(body).digest();

	return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

function applyDelivery(
	ctx: AppContext,
	deliveryId: string,
	action: SponsorshipAction,
	event: SponsorshipEvent,
): Promise<WebhookStatus> {
	const now = ctx.now();

	return ctx.db.transaction(async (tx): Promise<WebhookStatus> => {
		const recorded = await tx
			.insert(sponsorWebhookDelivery)
			.values({ id: deliveryId, action, receivedAt: now })
			.onConflictDoNothing()
			.returning({ id: sponsorWebhookDelivery.id });

		if (recorded.length === 0) {
			return 'duplicate';
		}

		const [current] = await tx
			.select()
			.from(sponsorship)
			.where(eq(sponsorship.githubId, event.values.githubId));
		const lifecycle = TRANSITIONS[action](event, current, now);

		if (!lifecycle) {
			return 'unchanged';
		}

		await upsertSponsorship(tx, { ...event.values, ...lifecycle, updatedAt: now });

		return 'applied';
	});
}

/**
 * @description Handles a GitHub Sponsors webhook delivery: verifies its signature over the raw body,
 * ignores other events and other sponsored accounts, and applies each delivery id at most once.
 * @param ctx The application context.
 * @param request The webhook request.
 * @returns The response for GitHub, with `{ status }` describing what happened.
 */
export async function handleSponsorsWebhook(ctx: AppContext, request: Request): Promise<Response> {
	const secret = ctx.env.GITHUB_SPONSORS_WEBHOOK_SECRET;
	const login = ctx.env.GITHUB_SPONSORS_LOGIN?.toLowerCase();

	if (!secret || !login) {
		return new Response(null, { status: 404 });
	}

	if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
		return new Response(null, { status: 413 });
	}

	const body = new Uint8Array(await request.arrayBuffer());

	if (body.byteLength > MAX_BODY_BYTES) {
		return new Response(null, { status: 413 });
	}

	if (!verifySignature(secret, body, request.headers.get('x-hub-signature-256'))) {
		return new Response(null, { status: 401 });
	}

	if (request.headers.get('x-github-event') !== 'sponsorship') {
		return status('ignored', 202);
	}

	if (!request.headers.get('content-type')?.startsWith('application/json')) {
		return new Response(null, { status: 415 });
	}

	const deliveryId = request.headers.get('x-github-delivery');
	const payload = payloadSchema.safeParse(parseJson(body));

	if (!deliveryId || !payload.success) {
		return new Response(null, { status: 400 });
	}

	const { action, effective_date, sponsorship: remote } = payload.data;

	if (
		!isSponsorshipAction(action) ||
		!remote.sponsor ||
		remote.sponsorable.login.toLowerCase() !== login
	) {
		return status('ignored', 202);
	}

	const event: SponsorshipEvent = {
		values: {
			githubId: remote.sponsor.id,
			githubLogin: remote.sponsor.login,
			tierName: remote.tier.name,
			monthlyPriceCents: remote.tier.monthly_price_in_cents,
			oneTime: remote.tier.is_one_time,
			since: remote.created_at,
		},
		effectiveDate: effective_date,
	};
	const result = await applyDelivery(ctx, deliveryId, action, event);

	logger.info(`Sponsorship ${action} from ${remote.sponsor.login}: ${result}.`);

	return status(result);
}

export default { verifySignature, handleSponsorsWebhook };
