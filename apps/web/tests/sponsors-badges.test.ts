import {
	badgeClaimResponseSchema,
	userBadgesResponseSchema,
} from '@unbound-app/contracts/sponsors';
import type { Badge } from '@unbound-app/contracts/sponsors';
import { afterAll, describe, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import type { SponsorStanding, Sponsorship } from '~/lib/sponsors/standing';
import listUserBadgesEndpoint from '~/endpoints/list-user-badges';
import removeMyBadgeEndpoint from '~/endpoints/remove-my-badge';
import restoreBadgeEndpoint from '~/endpoints/restore-badge';
import revokeBadgeEndpoint from '~/endpoints/revoke-badge';
import setMyBadgeEndpoint from '~/endpoints/set-my-badge';
import { getVisibleBadges } from '~/lib/sponsors/badges';
import { isPerkUnlocked } from '~/lib/sponsors/perks';
import { standingOf } from '~/lib/sponsors/standing';
import type { AppContext } from '~/lib/context';
import { createApiClient } from '~/api/client';
import type { Role } from '~/lib/auth/access';
import { account, perkClaim, user } from '~/db/schema';
import type { Api } from '~/api';

import type { SeededSponsorship } from './helpers/sponsors';

import { createTestContext, linkGitHub, signInWithDiscord } from './helpers/context';
import { failure, serveEndpoints } from './helpers/server';
import { seedSponsorship } from './helpers/sponsors';

type SponsorOptions = {
	role?: Role;
	github?: boolean;
	sponsorship?: Omit<SeededSponsorship, 'githubId'> | null;
};

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-03-01T00:00:00Z');
const GRACE = 7 * DAY;

const BADGE: Badge = { label: 'Night Owl', icon: 'moon', color: 'purple' };

const base = await createTestContext();
const ctx: AppContext = { ...base.ctx, now: () => NOW };

const server = serveEndpoints(ctx, {
	'GET /api/v1/users/$id/badges': listUserBadgesEndpoint,
	'PUT /api/v1/me/badge': setMyBadgeEndpoint,
	'DELETE /api/v1/me/badge': removeMyBadgeEndpoint,
	'POST /api/v1/users/$id/badge/revoke': revokeBadgeEndpoint,
	'DELETE /api/v1/users/$id/badge/revoke': restoreBadgeEndpoint,
});

const anonymous = createApiClient<Api>({ baseUrl: server.url.href });

afterAll(async () => {
	await server.stop(true);
	await base.close();
});

let users = 0;

async function signUp({ role = 'user', github = true, sponsorship = {} }: SponsorOptions = {}) {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: `8035111022469${String(users).padStart(4, '0')}`,
		name: `Sponsor ${users}`,
		email: `sponsor-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	if (github) {
		await linkGitHub(ctx, userId, `token-${users}`);
	}

	if (github && sponsorship) {
		await seedSponsorship(ctx, { githubId: userId, ...sponsorship });
	}

	return { userId, client: createApiClient<Api>({ baseUrl: server.url.href, headers }) };
}

type Client = Awaited<ReturnType<typeof signUp>>['client'];

async function waitForLockWait() {
	for (let i = 0; i < 250; i++) {
		const [row] = await ctx.db.$client<{ waiting: number }[]>`
			select count(*)::int as waiting from pg_stat_activity
			where datname = current_database() and wait_event_type = 'Lock'`;

		if (row?.waiting) return;

		await Bun.sleep(20);
	}

	throw new Error('Expected a statement waiting on a lock.');
}

function setBadge(client: Client, badge: Badge = BADGE) {
	return client('PUT /api/v1/me/badge', { body: badge, response: badgeClaimResponseSchema });
}

function publicBadges(userId: string) {
	return anonymous('GET /api/v1/users/$id/badges', {
		params: { id: userId },
		response: userBadgesResponseSchema,
	});
}

function row(overrides: Partial<Sponsorship>): Sponsorship {
	return {
		githubId: '1',
		githubLogin: 'sponsor',
		state: 'active',
		tierName: '$5 a month',
		monthlyPriceCents: 500,
		oneTime: false,
		since: new Date('2026-01-01T00:00:00Z'),
		endsAt: null,
		updatedAt: new Date('2026-02-01T00:00:00Z'),
		...overrides,
	};
}

function judge(
	sponsorship: Sponsorship | undefined,
	now: Date,
): [SponsorStanding['kind'], boolean] {
	const standing = standingOf(sponsorship, now, GRACE);

	return [standing.kind, isPerkUnlocked('custom-badge', standing)];
}

describe('standing and eligibility', () => {
	const ends = new Date('2026-03-10T00:00:00Z');

	test.each([
		['no sponsorship', undefined, NOW, 'none', false],
		['active monthly', row({}), NOW, 'active', true],
		['active at exactly $1', row({ monthlyPriceCents: 100 }), NOW, 'active', true],
		['active below $1', row({ monthlyPriceCents: 99 }), NOW, 'active', false],
		['one-time', row({ oneTime: true }), NOW, 'active', false],
		[
			'pending, before it takes effect',
			row({ state: 'pending_cancellation', endsAt: ends }),
			NOW,
			'active',
			true,
		],
		[
			'pending, after it takes effect',
			row({ state: 'pending_cancellation', endsAt: ends }),
			new Date(ends.getTime() + DAY),
			'grace',
			true,
		],
		[
			'cancelled, last moment of grace',
			row({ state: 'cancelled', endsAt: ends }),
			new Date(ends.getTime() + GRACE - 1),
			'grace',
			true,
		],
		[
			'cancelled, grace over',
			row({ state: 'cancelled', endsAt: ends }),
			new Date(ends.getTime() + GRACE),
			'lapsed',
			false,
		],
	] as const)('%s', (_name, sponsorship, now, kind, unlocked) => {
		expect(judge(sponsorship, now)).toEqual([kind, unlocked]);
	});
});

describe('claiming a badge', () => {
	test('an active monthly sponsor sets, changes and removes their badge', async () => {
		const sponsor = await signUp();

		expect(await setBadge(sponsor.client)).toEqual({
			claim: { ...BADGE, revokedAt: null, revokeReason: null },
		});
		expect(await publicBadges(sponsor.userId)).toEqual({
			badges: [{ ...BADGE, kind: 'custom-badge' }],
		});

		await setBadge(sponsor.client, { label: 'Early Bird', icon: 'sparkles', color: 'teal' });
		expect(await publicBadges(sponsor.userId)).toEqual({
			badges: [
				{ label: 'Early Bird', icon: 'sparkles', color: 'teal', kind: 'custom-badge' },
			],
		});

		expect(
			await sponsor.client('DELETE /api/v1/me/badge', { response: badgeClaimResponseSchema }),
		).toEqual({ claim: null });
		expect(await publicBadges(sponsor.userId)).toEqual({ badges: [] });
	});

	test('needs a linked, active, recurring sponsorship of at least $1', async () => {
		const ineligible = await Promise.all([
			signUp({ github: false }),
			signUp({ sponsorship: null }),
			signUp({ sponsorship: { oneTime: true } }),
			signUp({ sponsorship: { monthlyPriceCents: 50 } }),
			signUp({ sponsorship: { state: 'cancelled', endsAt: new Date(NOW.getTime() - DAY) } }),
		]);

		for (const sponsor of ineligible) {
			expect(await failure(setBadge(sponsor.client))).toEqual({
				status: 403,
				code: 'sponsorship_required',
			});
		}

		expect(await failure(setBadge(anonymous))).toEqual({ status: 401, code: 'unauthorized' });
	});

	test('refuses labels outside the allowed characters and length', async () => {
		const sponsor = await signUp();
		const labels = ['', 'x'.repeat(25), 'Cool 😎', 'st\u0430ff', 'Line\nBreak', ' - lead'];

		for (const label of labels) {
			expect(await failure(setBadge(sponsor.client, { ...BADGE, label }))).toEqual({
				status: 400,
				code: 'invalid_request',
			});
		}
	});

	test('refuses profanity and labels that impersonate staff', async () => {
		const sponsor = await signUp();
		const labels = [
			'Fuck Yeah',
			'f u c k',
			'S t a f f',
			'Admins',
			'Official',
			'Unbound Dev',
			'Discord.Mod',
			'Stäff',
		];

		for (const label of labels) {
			expect(await failure(setBadge(sponsor.client, { ...BADGE, label }))).toEqual({
				status: 400,
				code: 'badge_rejected',
			});
		}

		expect(await publicBadges(sponsor.userId)).toEqual({ badges: [] });
	});

	test('allows ordinary words that only contain a reserved word', async () => {
		const sponsor = await signUp();

		for (const label of ['Supporter', 'Modern Themes', 'Badminton', 'Steam Deck']) {
			const { claim } = await setBadge(sponsor.client, { ...BADGE, label });

			expect(claim?.label).toBe(label);
		}
	});
});

describe('revoking a badge', () => {
	test('staff revoke hides it and blocks setting another until they restore it', async () => {
		const sponsor = await signUp();
		const moderator = await signUp({ role: 'moderator', github: false });
		const stranger = await signUp();

		await setBadge(sponsor.client);

		expect(
			await failure(
				stranger.client('POST /api/v1/users/$id/badge/revoke', {
					params: { id: sponsor.userId },
					body: { reason: 'No.' },
					response: badgeClaimResponseSchema,
				}),
			),
		).toEqual({ status: 403, code: 'forbidden' });

		const revoked = await moderator.client('POST /api/v1/users/$id/badge/revoke', {
			params: { id: sponsor.userId },
			body: { reason: 'Misleading label.' },
			response: badgeClaimResponseSchema,
		});

		expect(revoked.claim).toMatchObject({
			revokedAt: NOW.toISOString(),
			revokeReason: 'Misleading label.',
		});
		expect(await publicBadges(sponsor.userId)).toEqual({ badges: [] });
		expect(await failure(setBadge(sponsor.client))).toEqual({
			status: 403,
			code: 'perk_revoked',
		});

		await sponsor.client('DELETE /api/v1/me/badge', { response: badgeClaimResponseSchema });
		expect(await failure(setBadge(sponsor.client))).toEqual({
			status: 403,
			code: 'perk_revoked',
		});

		await moderator.client('DELETE /api/v1/users/$id/badge/revoke', {
			params: { id: sponsor.userId },
			response: badgeClaimResponseSchema,
		});
		expect(await publicBadges(sponsor.userId)).toEqual({
			badges: [{ ...BADGE, kind: 'custom-badge' }],
		});
	});

	test('a revoke landing while a badge is being set keeps the revoked badge', async () => {
		const sponsor = await signUp();
		const locked = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();

		await setBadge(sponsor.client);

		const revoke = ctx.db.$client.begin(async (sql) => {
			await sql`select 1 from perk_claim where user_id = ${sponsor.userId} for update`;
			locked.resolve();
			await release.promise;
			await sql`update perk_claim set revoked_at = now() where user_id = ${sponsor.userId}`;
		});

		await locked.promise;

		const replaced = failure(setBadge(sponsor.client, { ...BADGE, label: 'Replaced' }));

		await waitForLockWait();
		release.resolve();
		await revoke;

		expect(await replaced).toEqual({ status: 403, code: 'perk_revoked' });

		const [stored] = await ctx.db
			.select({ config: perkClaim.config })
			.from(perkClaim)
			.where(eq(perkClaim.userId, sponsor.userId));

		expect(stored?.config).toEqual(BADGE);
	});

	test('NUL in the path or the reason is an invalid request', async () => {
		const moderator = await signUp({ role: 'moderator', github: false });
		const sponsor = await signUp();

		await setBadge(sponsor.client);

		expect(await failure(publicBadges('nul\0id'))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
		expect(
			await failure(
				moderator.client('POST /api/v1/users/$id/badge/revoke', {
					params: { id: sponsor.userId },
					body: { reason: 'Bad\0label.' },
					response: badgeClaimResponseSchema,
				}),
			),
		).toEqual({ status: 400, code: 'invalid_request' });
	});

	test('revoking a user without a badge is not found', async () => {
		const moderator = await signUp({ role: 'moderator', github: false });
		const plain = await signUp();

		expect(
			await failure(
				moderator.client('POST /api/v1/users/$id/badge/revoke', {
					params: { id: plain.userId },
					body: { reason: 'No badge.' },
					response: badgeClaimResponseSchema,
				}),
			),
		).toEqual({ status: 404, code: 'not_found' });
	});
});

describe('getVisibleBadges', () => {
	test('keeps a badge through the grace period after a cancellation, then hides it', async () => {
		const sponsor = await signUp({
			sponsorship: { state: 'pending_cancellation', endsAt: new Date(NOW.getTime() + DAY) },
		});

		await setBadge(sponsor.client);

		const at = (offset: number) =>
			getVisibleBadges({ ...ctx, now: () => new Date(NOW.getTime() + offset) }, [
				sponsor.userId,
			]).then((badges) => badges.has(sponsor.userId));

		expect(await Promise.all([at(0), at(DAY + GRACE - 1), at(DAY + GRACE)])).toEqual([
			true,
			true,
			false,
		]);
	});

	test('hides the badges of banned users until their ban expires', async () => {
		const banned = await signUp();
		const expired = await signUp();

		await setBadge(banned.client);
		await setBadge(expired.client);
		await ctx.db
			.update(user)
			.set({ banned: true, banExpires: new Date(NOW.getTime() + DAY) })
			.where(eq(user.id, banned.userId));
		await ctx.db
			.update(user)
			.set({ banned: true, banExpires: new Date(NOW.getTime() - DAY) })
			.where(eq(user.id, expired.userId));

		const badges = await getVisibleBadges(ctx, [banned.userId, expired.userId]);

		expect([...badges.keys()]).toEqual([expired.userId]);
	});

	test('hides the badge once GitHub is unlinked', async () => {
		const sponsor = await signUp();

		await setBadge(sponsor.client);
		await ctx.db
			.delete(account)
			.where(and(eq(account.userId, sponsor.userId), eq(account.providerId, 'github')));

		expect(await publicBadges(sponsor.userId)).toEqual({ badges: [] });
	});
});
