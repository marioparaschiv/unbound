import { Type, parse } from '@unbound-app/contracts/schema';
import type { Static } from '@unbound-app/contracts/schema';
import { createLogger } from '@unbound-app/logger';
import { lt } from 'drizzle-orm';

import type { SponsorshipLifecycle, SponsorshipValues } from '~/lib/sponsors/sponsorships';
import { graceMs, upsertSponsorship } from '~/lib/sponsors/sponsorships';
import { isSponsoring, standingOf } from '~/lib/sponsors/standing';
import { sponsorship, sponsorWebhookDelivery } from '~/db/schema';
import type { Sponsorship } from '~/lib/sponsors/standing';
import { startPeriodicJob, type Job } from '~/lib/jobs';
import type { AppContext } from '~/lib/context';
import { DAY_MS } from '~/lib/calendar-date';
import type { Env } from '~/lib/env';

const logger = createLogger('Web', 'Sponsors');

const DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// GitHub lists a sponsorship as inactive until its payment settles, which takes up to a few days.
const PROCESSING_WINDOW_MS = 7 * DAY_MS;

const SPONSORSHIPS_QUERY = `query ($login: String!, $after: String) {
	repositoryOwner(login: $login) {
		... on Sponsorable {
			sponsorshipsAsMaintainer(first: 100, after: $after, includePrivate: true, activeOnly: false) {
				pageInfo { hasNextPage endCursor }
				nodes {
					createdAt
					isActive
					isOneTimePayment
					privacyLevel
					tier { name monthlyPriceInCents isOneTime }
					sponsorEntity {
						__typename
						... on User { databaseId login }
						... on Organization { databaseId login }
					}
				}
			}
		}
	}
}`;

const pageSchema = Type.Object({
	data: Type.Object({
		repositoryOwner: Type.Object({
			sponsorshipsAsMaintainer: Type.Object({
				pageInfo: Type.Object({
					hasNextPage: Type.Boolean(),
					endCursor: Type.Union([Type.String(), Type.Null()]),
				}),
				nodes: Type.Array(
					Type.Object({
						createdAt: Type.String({ format: 'date-time' }),
						isActive: Type.Boolean(),
						isOneTimePayment: Type.Boolean(),
						privacyLevel: Type.Enum(['PUBLIC', 'PRIVATE']),
						tier: Type.Union([
							Type.Object({
								name: Type.String(),
								monthlyPriceInCents: Type.Integer({ minimum: 0 }),
							}),
							Type.Null(),
						]),
						// A deleted sponsor's account resolves to null.
						sponsorEntity: Type.Union([
							Type.Object({ databaseId: Type.Integer(), login: Type.String() }),
							Type.Null(),
						]),
					}),
				),
			}),
		}),
	}),
});

const errorsSchema = Type.Object({
	errors: Type.Optional(Type.Array(Type.Object({ message: Type.String() }))),
});

type SponsorsConfig = {
	url: URL;
	login: string;
	token: string;
};

type SponsorshipsPage = Static<
	typeof pageSchema
>['data']['repositoryOwner']['sponsorshipsAsMaintainer'];

export type RemoteSponsorship = SponsorshipValues &
	Pick<Sponsorship, 'largestOneTimeCents'> & {
		active: boolean;
		/** Inactive but younger than the processing window, so its payment has not settled yet. */
		processing: boolean;
	};

export type ReconcileResult = {
	fetched: number;
	updated: number;
};

function sponsorsConfig(env: Env): SponsorsConfig | undefined {
	const { GITHUB_SPONSORS_LOGIN: login, GITHUB_SPONSORS_TOKEN: token } = env;

	if (!login || !token) return;

	return { url: new URL('/graphql', env.GITHUB_API_URL), login, token };
}

async function fetchPage(config: SponsorsConfig, after: string | null): Promise<SponsorshipsPage> {
	const response = await fetch(config.url, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${config.token}`,
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			query: SPONSORSHIPS_QUERY,
			variables: { login: config.login, after },
		}),
	});

	if (!response.ok) {
		throw new Error(`GitHub GraphQL answered ${response.status}.`);
	}

	const body = await response.json();
	const { errors } = parse(errorsSchema, body);

	if (errors?.length) {
		throw new Error(
			`GitHub GraphQL failed: ${errors.map((error) => error.message).join('; ')}`,
		);
	}

	return parse(pageSchema, body).data.repositoryOwner.sponsorshipsAsMaintainer;
}

/**
 * @description Reads every sponsorship of the sponsored account, past ones included, page by page.
 * Any failed or malformed page fails the whole read.
 * @param env The validated environment, with the Sponsors login and token set.
 * @param now The current time, which tells a processing sponsorship from a past one.
 * @returns The sponsorships by sponsor GitHub id; an active one wins over a processing one, which wins
 * over a past one, and each carries the sponsor's largest settled one-time payment across all of theirs.
 */
export async function fetchRemoteSponsorships(
	env: Env,
	now: Date,
): Promise<Map<string, RemoteSponsorship>> {
	const config = sponsorsConfig(env);

	if (!config) {
		throw new Error('GITHUB_SPONSORS_LOGIN and GITHUB_SPONSORS_TOKEN must be set.');
	}

	const remote = new Map<string, RemoteSponsorship>();
	let after: string | null = null;
	let hasNextPage = true;

	while (hasNextPage) {
		const page = await fetchPage(config, after);

		for (const node of page.nodes) {
			if (!node.sponsorEntity) {
				continue;
			}

			const githubId = String(node.sponsorEntity.databaseId);
			const previous = remote.get(githubId);
			const since = new Date(node.createdAt);
			const processing =
				!node.isActive && now.getTime() - since.getTime() < PROCESSING_WINDOW_MS;
			const largestOneTimeCents = Math.max(
				previous?.largestOneTimeCents ?? 0,
				node.isOneTimePayment && !processing ? (node.tier?.monthlyPriceInCents ?? 0) : 0,
			);

			if (previous?.active || (previous?.processing && !node.isActive)) {
				remote.set(githubId, { ...previous, largestOneTimeCents });
				continue;
			}

			remote.set(githubId, {
				githubId,
				githubLogin: node.sponsorEntity.login,
				tierName: node.tier?.name ?? 'Custom amount',
				monthlyPriceCents: node.tier?.monthlyPriceInCents ?? 0,
				oneTime: node.isOneTimePayment,
				isPublic: node.privacyLevel === 'PUBLIC',
				since,
				largestOneTimeCents,
				active: node.isActive,
				processing,
			});
		}

		hasNextPage = page.pageInfo.hasNextPage;
		after = page.pageInfo.endCursor;
	}

	return remote;
}

function nextLifecycle(
	current: Sponsorship | undefined,
	remote: RemoteSponsorship | undefined,
	now: Date,
): SponsorshipLifecycle | undefined {
	if (remote?.active) {
		// GraphQL cannot see a pending cancellation, so one that has not taken effect yet stands.
		if (current?.state === 'pending_cancellation' && current.endsAt && current.endsAt > now) {
			return { state: current.state, endsAt: current.endsAt };
		}

		return { state: 'active', endsAt: null };
	}

	if (remote?.processing) {
		return { state: 'processing', endsAt: null };
	}

	if (!current) {
		// A past one-time payment is stored anyway, since the perks it unlocks are permanent.
		return remote?.largestOneTimeCents
			? { state: 'cancelled', endsAt: remote.since }
			: undefined;
	}

	if (current.state === 'cancelled') {
		return { state: current.state, endsAt: current.endsAt };
	}

	// A payment that never settled ends where it began, so it leaves no grace period behind.
	if (current.state === 'processing') {
		return { state: 'cancelled', endsAt: current.since };
	}

	return { state: 'cancelled', endsAt: current.endsAt ?? now };
}

function isSameSponsorship(current: Sponsorship, next: Sponsorship): boolean {
	return (
		current.githubLogin === next.githubLogin &&
		current.state === next.state &&
		current.tierName === next.tierName &&
		current.monthlyPriceCents === next.monthlyPriceCents &&
		current.oneTime === next.oneTime &&
		current.largestOneTimeCents === next.largestOneTimeCents &&
		current.isPublic === next.isPublic &&
		current.since.getTime() === next.since.getTime() &&
		current.endsAt?.getTime() === next.endsAt?.getTime()
	);
}

// GitHub lags behind a `created` webhook, and a new payment must not hide a sponsorship still in grace.
function keepsCurrent(
	current: Sponsorship,
	reported: RemoteSponsorship,
	now: Date,
	grace: number,
): boolean {
	return (
		current.state !== 'processing' &&
		(current.since >= reported.since || isSponsoring(standingOf(current, now, grace)))
	);
}

/**
 * @description Works out which stored sponsorships differ from what GitHub reports.
 * @param local Every stored sponsorship.
 * @param remote GitHub's sponsorships by sponsor id.
 * @param now The current time.
 * @param startedAt When the remote read began; rows written since then came from a webhook and win.
 * @param grace How long perks outlast a sponsorship, in milliseconds.
 * @returns The rows to write.
 */
export function planReconcile(
	local: Sponsorship[],
	remote: Map<string, RemoteSponsorship>,
	now: Date,
	startedAt: Date,
	grace: number,
): Sponsorship[] {
	const stored = new Map(local.map((row) => [row.githubId, row]));
	const ids = new Set([...stored.keys(), ...remote.keys()]);
	const writes: Sponsorship[] = [];

	for (const id of ids) {
		const current = stored.get(id);
		const reported = remote.get(id);

		if (current && current.updatedAt > startedAt) {
			continue;
		}

		if (current && reported?.processing && keepsCurrent(current, reported, now, grace)) {
			continue;
		}

		const lifecycle = nextLifecycle(current, reported, now);
		const values = reported ?? current;

		if (!lifecycle || !values) {
			continue;
		}

		const next: Sponsorship = {
			githubId: values.githubId,
			githubLogin: values.githubLogin,
			tierName: values.tierName,
			monthlyPriceCents: values.monthlyPriceCents,
			oneTime: values.oneTime,
			isPublic: values.isPublic,
			since: values.since,
			largestOneTimeCents: Math.max(
				current?.largestOneTimeCents ?? 0,
				reported?.largestOneTimeCents ?? 0,
			),
			...lifecycle,
			updatedAt: now,
		};

		if (current && isSameSponsorship(current, next)) {
			continue;
		}

		writes.push(next);
	}

	return writes;
}

/**
 * @description Brings stored sponsorships in line with GitHub, so missed webhooks converge. Nothing is
 * written unless every page was read; running it again without changes on GitHub writes nothing.
 * @param ctx The application context.
 * @returns How many sponsorships GitHub reported and how many rows changed.
 */
export async function reconcileSponsorships(ctx: AppContext): Promise<ReconcileResult> {
	const startedAt = ctx.now();
	const remote = await fetchRemoteSponsorships(ctx.env, startedAt);
	const now = ctx.now();

	const updated = await ctx.db.transaction(async (tx) => {
		const writes = planReconcile(
			await tx.select().from(sponsorship),
			remote,
			now,
			startedAt,
			graceMs(ctx.env),
		);

		for (const row of writes) {
			await upsertSponsorship(tx, row);
		}

		await tx
			.delete(sponsorWebhookDelivery)
			.where(
				lt(
					sponsorWebhookDelivery.receivedAt,
					new Date(now.getTime() - DELIVERY_RETENTION_MS),
				),
			);

		return writes.length;
	});

	return { fetched: remote.size, updated };
}

/**
 * @description Runs {@link reconcileSponsorships} at boot and every `SPONSOR_RECONCILE_INTERVAL_SECONDS`
 * as a periodic job when the Sponsors login and token are set.
 * @param ctx The application context.
 * @returns The started job, or `undefined` when Sponsors is not configured.
 */
export function startSponsorReconciler(ctx: AppContext): Job | undefined {
	if (!sponsorsConfig(ctx.env)) return;

	return startPeriodicJob(
		ctx.jobs,
		'sponsors',
		ctx.env.SPONSOR_RECONCILE_INTERVAL_SECONDS,
		async () => {
			const { fetched, updated } = await reconcileSponsorships(ctx);

			if (updated > 0) {
				logger.info(`Reconciled ${fetched} sponsorships, ${updated} changed.`);
			}
		},
	);
}

export default {
	fetchRemoteSponsorships,
	planReconcile,
	reconcileSponsorships,
	startSponsorReconciler,
};
