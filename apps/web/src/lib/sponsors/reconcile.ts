import { createLogger } from '@unbound-app/logger';
import { lt } from 'drizzle-orm';
import { z } from 'zod';

import type { SponsorshipLifecycle, SponsorshipValues } from '~/lib/sponsors/sponsorships';
import { upsertSponsorship } from '~/lib/sponsors/sponsorships';
import { sponsorship, sponsorWebhookDelivery } from '~/db/schema';
import type { Sponsorship } from '~/lib/sponsors/standing';
import type { AppContext } from '~/lib/context';
import type { Env } from '~/lib/env';

const logger = createLogger('Web', 'Sponsors');

const DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const SPONSORSHIPS_QUERY = `query ($login: String!, $after: String) {
	repositoryOwner(login: $login) {
		... on Sponsorable {
			sponsorshipsAsMaintainer(first: 100, after: $after, includePrivate: true, activeOnly: false) {
				pageInfo { hasNextPage endCursor }
				nodes {
					createdAt
					isActive
					isOneTimePayment
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

const pageSchema = z.object({
	data: z.object({
		repositoryOwner: z.object({
			sponsorshipsAsMaintainer: z.object({
				pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
				nodes: z.array(
					z.object({
						createdAt: z.iso.datetime({ offset: true }),
						isActive: z.boolean(),
						isOneTimePayment: z.boolean(),
						tier: z
							.object({
								name: z.string(),
								monthlyPriceInCents: z.int().nonnegative(),
							})
							.nullable(),
						// A deleted sponsor's account resolves to null.
						sponsorEntity: z
							.object({ databaseId: z.int(), login: z.string() })
							.nullable(),
					}),
				),
			}),
		}),
	}),
});

const errorsSchema = z.object({
	errors: z.array(z.object({ message: z.string() })).optional(),
});

type SponsorsConfig = {
	url: URL;
	login: string;
	token: string;
};

type SponsorshipsPage = z.infer<
	typeof pageSchema
>['data']['repositoryOwner']['sponsorshipsAsMaintainer'];

export type RemoteSponsorship = SponsorshipValues & {
	active: boolean;
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
	const { errors } = errorsSchema.parse(body);

	if (errors?.length) {
		throw new Error(
			`GitHub GraphQL failed: ${errors.map((error) => error.message).join('; ')}`,
		);
	}

	return pageSchema.parse(body).data.repositoryOwner.sponsorshipsAsMaintainer;
}

/**
 * @description Reads every sponsorship of the sponsored account, past ones included, page by page.
 * Any failed or malformed page fails the whole read.
 * @param env The validated environment, with the Sponsors login and token set.
 * @returns The sponsorships by sponsor GitHub id; an active one wins over an inactive one.
 */
export async function fetchRemoteSponsorships(env: Env): Promise<Map<string, RemoteSponsorship>> {
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

			if (remote.get(githubId)?.active) {
				continue;
			}

			remote.set(githubId, {
				githubId,
				githubLogin: node.sponsorEntity.login,
				tierName: node.tier?.name ?? 'Custom amount',
				monthlyPriceCents: node.tier?.monthlyPriceInCents ?? 0,
				oneTime: node.isOneTimePayment,
				since: new Date(node.createdAt),
				active: node.isActive,
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

	if (!current) return;

	if (current.state === 'cancelled') {
		return { state: current.state, endsAt: current.endsAt };
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
		current.since.getTime() === next.since.getTime() &&
		current.endsAt?.getTime() === next.endsAt?.getTime()
	);
}

/**
 * @description Works out which stored sponsorships differ from what GitHub reports.
 * @param local Every stored sponsorship.
 * @param remote GitHub's sponsorships by sponsor id.
 * @param now The current time.
 * @param startedAt When the remote read began; rows written since then came from a webhook and win.
 * @returns The rows to write.
 */
export function planReconcile(
	local: Sponsorship[],
	remote: Map<string, RemoteSponsorship>,
	now: Date,
	startedAt: Date,
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
			since: values.since,
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
	const remote = await fetchRemoteSponsorships(ctx.env);
	const now = ctx.now();

	const updated = await ctx.db.transaction(async (tx) => {
		const writes = planReconcile(await tx.select().from(sponsorship), remote, now, startedAt);

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
 * when the Sponsors login and token are set. A failed run is logged and retried on the next tick; a
 * slow run is never overlapped.
 * @param ctx The application context.
 * @returns The interval timer, or `undefined` when Sponsors is not configured.
 */
export function startSponsorReconciler(ctx: AppContext): Timer | undefined {
	if (!sponsorsConfig(ctx.env)) return;

	let running = false;

	async function reconcile() {
		if (running) return;

		running = true;

		try {
			const { fetched, updated } = await reconcileSponsorships(ctx);

			if (updated > 0) {
				logger.info(`Reconciled ${fetched} sponsorships, ${updated} changed.`);
			}
		} catch (error) {
			logger.error('Failed to reconcile sponsorships:', error);
		} finally {
			running = false;
		}
	}

	void reconcile();

	return setInterval(() => void reconcile(), ctx.env.SPONSOR_RECONCILE_INTERVAL_SECONDS * 1000);
}

export default {
	fetchRemoteSponsorships,
	planReconcile,
	reconcileSponsorships,
	startSponsorReconciler,
};
