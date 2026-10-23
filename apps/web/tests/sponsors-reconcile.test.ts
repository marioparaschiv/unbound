import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import { reconcileSponsorships } from '~/lib/sponsors/reconcile';
import type { AppContext } from '~/lib/context';
import { sponsorship } from '~/db/schema';

import { SPONSORED_LOGIN, seedSponsorship as seed, storedSponsorship } from './helpers/sponsors';
import { createTestContext } from './helpers/context';

type RemoteNode = {
	id: number;
	active: boolean;
	cents?: number;
	createdAt?: string;
};

type RemoteState = {
	nodes: RemoteNode[];
	failOnPage: number | undefined;
	requests: number;
};

type GraphQLRequest = {
	variables: { login: string; after: string | null };
};

const NOW = new Date('2026-03-01T00:00:00Z');
const PAGE_SIZE = 2;
const TOKEN = 'sponsors-token';

const remote: RemoteState = {
	nodes: [],
	failOnPage: undefined,
	requests: 0,
};

function toGraphQLNode(node: RemoteNode) {
	return {
		createdAt: node.createdAt ?? '2026-01-01T00:00:00Z',
		isActive: node.active,
		isOneTimePayment: false,
		tier: { name: 'Monthly', monthlyPriceInCents: node.cents ?? 500, isOneTime: false },
		sponsorEntity: { __typename: 'User', databaseId: node.id, login: `sponsor-${node.id}` },
	};
}

const github = Bun.serve({
	port: 0,
	routes: {
		'/graphql': {
			POST: async (request) => {
				const { variables } = (await request.json()) as GraphQLRequest;
				const start = Number(variables.after ?? 0);
				const page = start / PAGE_SIZE;

				remote.requests += 1;

				if (request.headers.get('authorization') !== `Bearer ${TOKEN}`) {
					return new Response(null, { status: 401 });
				}

				if (variables.login !== SPONSORED_LOGIN || page === remote.failOnPage) {
					return Response.json({ data: null, errors: [{ message: 'Something broke.' }] });
				}

				const end = start + PAGE_SIZE;

				return Response.json({
					data: {
						repositoryOwner: {
							sponsorshipsAsMaintainer: {
								pageInfo: {
									hasNextPage: end < remote.nodes.length,
									endCursor: String(end),
								},
								nodes: remote.nodes.slice(start, end).map(toGraphQLNode),
							},
						},
					},
				});
			},
		},
	},
});

const contexts: Array<() => void> = [];

function setup(): AppContext {
	const { ctx, close } = createTestContext({
		GITHUB_API_URL: github.url.href,
		GITHUB_SPONSORS_LOGIN: SPONSORED_LOGIN,
		GITHUB_SPONSORS_TOKEN: TOKEN,
	});

	contexts.push(close);
	remote.nodes = [];
	remote.failOnPage = undefined;
	remote.requests = 0;

	return { ...ctx, now: () => NOW };
}

afterEach(() => {
	for (const close of contexts.splice(0)) {
		close();
	}
});

afterAll(() => github.stop(true));

describe('reconcileSponsorships', () => {
	test('a sponsorship whose created webhook was missed converges to active across pages', async () => {
		const ctx = setup();

		remote.nodes = [
			{ id: 1, active: true },
			{ id: 2, active: false },
			{ id: 3, active: true, cents: 100 },
			{ id: 4, active: true },
			{ id: 5, active: true },
		];

		const result = await reconcileSponsorships(ctx);

		expect(remote.requests).toBe(3);
		expect(result).toEqual({ fetched: 5, updated: 4 });
		expect(storedSponsorship(ctx, '3')).toMatchObject({
			githubLogin: 'sponsor-3',
			state: 'active',
			monthlyPriceCents: 100,
			since: new Date('2026-01-01T00:00:00Z'),
		});
		expect(storedSponsorship(ctx, '2')).toBeUndefined();
	});

	test('a sponsorship whose cancelled webhook was missed converges to cancelled', async () => {
		const ctx = setup();

		seed(ctx, { githubId: '10' });
		seed(ctx, { githubId: '11' });
		remote.nodes = [{ id: 10, active: false }];

		await reconcileSponsorships(ctx);

		expect(storedSponsorship(ctx, '10')).toMatchObject({ state: 'cancelled', endsAt: NOW });
		expect(storedSponsorship(ctx, '11')).toMatchObject({ state: 'cancelled', endsAt: NOW });
	});

	test('a pending cancellation stands until it takes effect, then a still-active sponsor is reinstated', async () => {
		const ctx = setup();
		const later = new Date('2026-03-20T00:00:00Z');

		seed(ctx, { githubId: '20', state: 'pending_cancellation', endsAt: later });
		seed(ctx, {
			githubId: '21',
			state: 'pending_cancellation',
			endsAt: new Date('2026-02-20T00:00:00Z'),
		});
		remote.nodes = [
			{ id: 20, active: true },
			{ id: 21, active: true },
		];

		await reconcileSponsorships(ctx);

		expect(storedSponsorship(ctx, '20')).toMatchObject({
			state: 'pending_cancellation',
			endsAt: later,
		});
		expect(storedSponsorship(ctx, '21')).toMatchObject({ state: 'active', endsAt: null });
	});

	test('running it twice changes nothing the second time', async () => {
		const ctx = setup();

		seed(ctx, { githubId: '30' });
		remote.nodes = [
			{ id: 31, active: true },
			{ id: 32, active: false },
		];

		await reconcileSponsorships(ctx);

		const before = ctx.db.select().from(sponsorship).all();
		const second = await reconcileSponsorships(ctx);

		expect(second.updated).toBe(0);
		expect(ctx.db.select().from(sponsorship).all()).toEqual(before);
	});

	test('a failed page applies nothing, not even the absence sweep', async () => {
		const ctx = setup();

		seed(ctx, { githubId: '40' });
		remote.nodes = [
			{ id: 41, active: true },
			{ id: 42, active: true },
			{ id: 43, active: true },
		];
		remote.failOnPage = 1;

		const outcome = await reconcileSponsorships(ctx).then(
			() => 'resolved',
			(error: Error) => error.message,
		);

		expect(outcome).toMatch(/Something broke/);

		expect(ctx.db.select().from(sponsorship).all()).toEqual([
			expect.objectContaining({ githubId: '40', state: 'active' }),
		]);
	});

	test('a row a webhook wrote during the run is left alone', async () => {
		const ctx = setup();

		seed(ctx, { githubId: '50', updatedAt: new Date(NOW.getTime() + 1000) });

		await reconcileSponsorships(ctx);

		expect(storedSponsorship(ctx, '50')?.state).toBe('active');
	});
});
