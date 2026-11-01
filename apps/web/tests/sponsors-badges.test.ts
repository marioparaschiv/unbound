import { badgeClaimResponseSchema } from '@unbound-app/contracts/sponsors';
import type { Badge } from '@unbound-app/contracts/sponsors';
import { afterAll, describe, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import type { SponsorStanding, Sponsorship } from '~/lib/sponsors/standing';
import { account, perkClaim, sponsorship, user } from '~/db/schema';
import { getVisibleBadges } from '~/lib/sponsors/badges';
import { isPerkUnlocked } from '~/lib/sponsors/perks';
import { standingOf } from '~/lib/sponsors/standing';

import { createBadgeSuite } from './helpers/badges';
import { failure } from './helpers/server';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-03-01T00:00:00Z');
const GRACE = 7 * DAY;

const suite = await createBadgeSuite(NOW);
const { ctx, anonymous, signUp, setBadges, removeBadges, owned, shown, publicBadges } = suite;
const [MOON, LEAF, SUN, SPARE] = suite.images;

const BADGE: Badge = { name: 'Night Owl', image: MOON };

type Client = Awaited<ReturnType<typeof signUp>>['client'];

afterAll(suite.close);

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
	return setBadges(client, [badge]);
}

async function storedClaimCount(userId: string) {
	const rows = await ctx.db.select().from(perkClaim).where(eq(perkClaim.userId, userId));

	return rows.length;
}

function row(overrides: Partial<Sponsorship>): Sponsorship {
	return {
		githubId: '1',
		githubLogin: 'sponsor',
		state: 'active',
		tierName: '$5 a month',
		monthlyPriceCents: 500,
		oneTime: false,
		isPublic: false,
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
		['active at exactly $5', row({ monthlyPriceCents: 500 }), NOW, 'active', true],
		['active at $4.99', row({ monthlyPriceCents: 499 }), NOW, 'active', false],
		['active at $1', row({ monthlyPriceCents: 100 }), NOW, 'active', false],
		['one-time $10', row({ oneTime: true, monthlyPriceCents: 1000 }), NOW, 'active', false],
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
			'cancelled $1, within grace',
			row({ state: 'cancelled', endsAt: ends, monthlyPriceCents: 100 }),
			new Date(ends.getTime() + DAY),
			'grace',
			false,
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
			claim: { badges: owned(BADGE), revokedAt: null, revokeReason: null },
		});
		expect(await publicBadges(sponsor.userId)).toEqual(shown(BADGE));

		await setBadge(sponsor.client, { name: 'Early Bird', image: LEAF });
		expect(await publicBadges(sponsor.userId)).toEqual(
			shown({ name: 'Early Bird', image: LEAF }),
		);

		expect(await removeBadges(sponsor.client)).toEqual({ claim: null });
		expect(await publicBadges(sponsor.userId)).toEqual({ badges: [] });
	});

	test('needs a linked, active, recurring sponsorship of at least $5', async () => {
		const ineligible = await Promise.all([
			signUp({ github: false }),
			signUp({ sponsorship: null }),
			signUp({ sponsorship: { oneTime: true } }),
			signUp({ sponsorship: { monthlyPriceCents: 100, tierName: '$1 a month' } }),
			signUp({ sponsorship: { monthlyPriceCents: 499 } }),
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

	test('refuses names outside the allowed characters and length, and malformed image hashes', async () => {
		const sponsor = await signUp();
		const names = ['', 'x'.repeat(25), 'Cool 😎', 'st\u0430ff', 'Line\nBreak', ' - lead'];
		const badges = [
			...names.map((name) => ({ ...BADGE, name })),
			{ ...BADGE, image: 'not-a-hash' },
			{ ...BADGE, image: MOON.toUpperCase() },
		];

		for (const badge of badges) {
			expect(await failure(setBadge(sponsor.client, badge))).toEqual({
				status: 400,
				code: 'invalid_request',
			});
		}
	});

	test('refuses profanity and names that impersonate staff', async () => {
		const sponsor = await signUp();
		const names = [
			'Fuck Yeah',
			'f u c k',
			'S t a f f',
			'Admins',
			'Official',
			'Unbound Dev',
			'Discord.Mod',
			'Stäff',
		];

		for (const name of names) {
			expect(await failure(setBadge(sponsor.client, { ...BADGE, name }))).toEqual({
				status: 400,
				code: 'badge_rejected',
			});
		}

		expect(await publicBadges(sponsor.userId)).toEqual({ badges: [] });
	});

	test('allows ordinary words that only contain a reserved word', async () => {
		const sponsor = await signUp();

		for (const name of ['Supporter', 'Modern Themes', 'Badminton', 'Steam Deck']) {
			const { claim } = await setBadge(sponsor.client, { ...BADGE, name });

			expect(claim?.badges).toEqual(owned({ ...BADGE, name }));
		}
	});
});

describe('several badges', () => {
	const THREE: Badge[] = [
		BADGE,
		{ name: 'Early Bird', image: LEAF },
		{ name: 'Theme Fan', image: SUN },
	];

	test('a sponsor shows up to three badges, in the order they saved them', async () => {
		const sponsor = await signUp();

		expect((await setBadges(sponsor.client, THREE)).claim?.badges).toEqual(owned(...THREE));
		expect(await publicBadges(sponsor.userId)).toEqual(shown(...THREE));

		const reordered = [THREE[2]!, THREE[0]!];

		await setBadges(sponsor.client, reordered);
		expect(await publicBadges(sponsor.userId)).toEqual(shown(...reordered));
	});

	test('refuses an empty list or a fourth badge', async () => {
		const sponsor = await signUp();
		const four = [...THREE, { name: 'Fourth', image: SPARE }];

		for (const badges of [[], four]) {
			expect(await failure(setBadges(sponsor.client, badges))).toEqual({
				status: 400,
				code: 'invalid_request',
			});
		}
	});

	test('refuses two badges with the same name, ignoring case', async () => {
		const sponsor = await signUp();

		expect(
			await failure(setBadges(sponsor.client, [BADGE, { name: 'night owl', image: LEAF }])),
		).toEqual({ status: 400, code: 'badge_rejected' });
	});

	test('one refused name refuses the whole list and keeps the saved one', async () => {
		const sponsor = await signUp();

		await setBadge(sponsor.client);

		expect(
			await failure(setBadges(sponsor.client, [THREE[1]!, { ...BADGE, name: 'Admins' }])),
		).toEqual({ status: 400, code: 'badge_rejected' });
		expect(await publicBadges(sponsor.userId)).toEqual(shown(BADGE));
	});

	test('a revoke, a ban, an unlink or the end of grace hides all of them', async () => {
		const moderator = await signUp({ role: 'moderator', github: false });
		const [revoked, banned, unlinked, lapsed] = await Promise.all([
			signUp(),
			signUp(),
			signUp(),
			signUp({
				sponsorship: {
					state: 'pending_cancellation',
					endsAt: new Date(NOW.getTime() + DAY),
				},
			}),
		]);
		const sponsors = [revoked, banned, unlinked, lapsed];

		for (const sponsor of sponsors) {
			await setBadges(sponsor.client, THREE);
		}

		await moderator.client('POST /api/v1/users/$id/badge/revoke', {
			params: { id: revoked.userId },
			body: { reason: 'No.' },
			response: badgeClaimResponseSchema,
		});
		await ctx.db.update(user).set({ banned: true }).where(eq(user.id, banned.userId));
		await ctx.db
			.delete(account)
			.where(and(eq(account.userId, unlinked.userId), eq(account.providerId, 'github')));

		const ids = sponsors.map((sponsor) => sponsor.userId);
		const afterGrace = { ...ctx, now: () => new Date(NOW.getTime() + DAY + GRACE) };

		expect([...(await getVisibleBadges(ctx, ids))]).toEqual([
			[lapsed.userId, shown(...THREE).badges],
		]);
		expect((await getVisibleBadges(afterGrace, ids)).size).toBe(0);
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

		await removeBadges(sponsor.client);
		expect(await failure(setBadge(sponsor.client))).toEqual({
			status: 403,
			code: 'perk_revoked',
		});

		await moderator.client('DELETE /api/v1/users/$id/badge/revoke', {
			params: { id: sponsor.userId },
			response: badgeClaimResponseSchema,
		});
		expect(await publicBadges(sponsor.userId)).toEqual(shown(BADGE));
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

		const replaced = failure(setBadge(sponsor.client, { ...BADGE, name: 'Replaced' }));

		await waitForLockWait();
		release.resolve();
		await revoke;

		expect(await replaced).toEqual({ status: 403, code: 'perk_revoked' });

		const [stored] = await ctx.db
			.select({ config: perkClaim.config })
			.from(perkClaim)
			.where(eq(perkClaim.userId, sponsor.userId));

		expect(stored?.config).toEqual([BADGE]);
	});

	test('NUL in the path, or NUL or a lone surrogate in the reason, is an invalid request', async () => {
		const moderator = await signUp({ role: 'moderator', github: false });
		const sponsor = await signUp();

		await setBadge(sponsor.client);

		expect(await failure(publicBadges('nul\0id'))).toEqual({
			status: 400,
			code: 'invalid_request',
		});

		for (const reason of ['Bad\0label.', 'Bad\ud800label.', 'Bad\udc00label.']) {
			expect(
				await failure(
					moderator.client('POST /api/v1/users/$id/badge/revoke', {
						params: { id: sponsor.userId },
						body: { reason },
						response: badgeClaimResponseSchema,
					}),
				),
			).toEqual({ status: 400, code: 'invalid_request' });
		}
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

	test('keeps a badge stored below $5 but hides it until the tier reaches $5 again', async () => {
		const sponsor = await signUp();
		const githubId = sponsor.userId;

		await setBadge(sponsor.client);
		await ctx.db
			.update(sponsorship)
			.set({ monthlyPriceCents: 100 })
			.where(eq(sponsorship.githubId, githubId));

		expect(await publicBadges(sponsor.userId)).toEqual({ badges: [] });
		expect(await storedClaimCount(sponsor.userId)).toBe(1);

		await ctx.db
			.update(sponsorship)
			.set({ monthlyPriceCents: 500 })
			.where(eq(sponsorship.githubId, githubId));

		expect(await publicBadges(sponsor.userId)).toEqual(shown(BADGE));
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
