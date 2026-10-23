import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { handleSponsorsWebhook } from '~/lib/sponsors/webhook';
import type { Sponsorship } from '~/lib/sponsors/standing';
import type { AppContext } from '~/lib/context';
import { sponsorship } from '~/db/schema';

export const SPONSORED_LOGIN = 'unbound-app';

export const WEBHOOK_SECRET = 'sponsors-webhook-secret';

export type SponsorshipPayloadOptions = {
	action: string;
	sponsorId: string;
	sponsorLogin?: string;
	sponsorable?: string;
	createdAt?: string;
	tierName?: string;
	cents?: number;
	oneTime?: boolean;
	effectiveDate?: string;
};

/** A sponsorship payload, another event's payload such as `ping`, or a raw body. */
export type WebhookPayload =
	| ReturnType<typeof sponsorshipPayload>
	| Record<string, string>
	| string;

export type SeededSponsorship = Partial<Sponsorship> & Pick<Sponsorship, 'githubId'>;

export type DeliveryOptions = {
	id: string;
	event?: string;
	secret?: string;
	signature?: string | null;
	contentType?: string;
};

/**
 * @description Builds a `sponsorship` webhook payload shaped like GitHub's.
 * @param options The action, sponsor and tier.
 * @returns The payload.
 */
export function sponsorshipPayload({
	action,
	sponsorId,
	sponsorLogin = `sponsor-${sponsorId}`,
	sponsorable = SPONSORED_LOGIN,
	createdAt = '2026-01-01T00:00:00+00:00',
	tierName = '$5 a month',
	cents = 500,
	oneTime = false,
	effectiveDate,
}: SponsorshipPayloadOptions) {
	return {
		action,
		...(effectiveDate ? { effective_date: effectiveDate } : {}),
		sponsorship: {
			node_id: `S_${sponsorId}`,
			created_at: createdAt,
			sponsorable: { login: sponsorable, id: 1, type: 'Organization' },
			sponsor: { login: sponsorLogin, id: Number(sponsorId), type: 'User' },
			privacy_level: 'public',
			tier: {
				name: tierName,
				monthly_price_in_cents: cents,
				monthly_price_in_dollars: cents / 100,
				is_one_time: oneTime,
				is_custom_amount: false,
			},
		},
		sender: { login: sponsorLogin, id: Number(sponsorId) },
	};
}

/**
 * @description Signs a body as GitHub does for `X-Hub-Signature-256`.
 * @param secret The webhook secret.
 * @param body The raw body.
 * @returns The header value.
 */
export function sign(secret: string, body: string): string {
	return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/**
 * @description Delivers a webhook to the handler as GitHub would, signed unless told otherwise.
 * @param ctx The application context.
 * @param payload The JSON payload, or a raw string body.
 * @param options The delivery id, event and signing overrides.
 * @returns The handler's response.
 */
export function deliver(ctx: AppContext, payload: WebhookPayload, options: DeliveryOptions) {
	const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
	const signature =
		options.signature === undefined
			? sign(options.secret ?? WEBHOOK_SECRET, body)
			: options.signature;
	const headers = new Headers({
		'content-type': options.contentType ?? 'application/json',
		'x-github-event': options.event ?? 'sponsorship',
		'x-github-delivery': options.id,
	});

	if (signature !== null) {
		headers.set('x-hub-signature-256', signature);
	}

	return handleSponsorsWebhook(
		ctx,
		new Request('http://localhost/api/webhooks/github-sponsors', {
			method: 'POST',
			headers,
			body,
		}),
	);
}

/**
 * @description Stores a sponsorship directly: an active $5 monthly one unless overridden.
 * @param ctx The application context.
 * @param row The sponsor's GitHub id and any columns to override.
 */
export function seedSponsorship(ctx: AppContext, row: SeededSponsorship) {
	ctx.db
		.insert(sponsorship)
		.values({
			githubLogin: `sponsor-${row.githubId}`,
			state: 'active',
			tierName: '$5 a month',
			monthlyPriceCents: 500,
			oneTime: false,
			since: new Date('2026-01-01T00:00:00Z'),
			endsAt: null,
			updatedAt: new Date('2026-02-01T00:00:00Z'),
			...row,
		})
		.run();
}

/**
 * @description Reads the stored sponsorship of a GitHub user.
 * @param ctx The application context.
 * @param githubId The sponsor's GitHub id.
 * @returns The row, or `undefined`.
 */
export function storedSponsorship(ctx: AppContext, githubId: string) {
	return ctx.db.select().from(sponsorship).where(eq(sponsorship.githubId, githubId)).get();
}
