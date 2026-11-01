import type { Badge } from '@unbound-app/contracts/sponsors';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { getBadgeImageKey, hashBadgeImage } from '~/lib/sponsors/badge-image';
import { getVisibleBadges, toBadgeClaim } from '~/lib/sponsors/badges';
import { perkClaim } from '~/db/schema';

import { createBadgeSuite } from './helpers/badges';
import { failure } from './helpers/server';
import { encodePng } from './helpers/png';

const NOW = new Date('2026-03-01T00:00:00Z');

const suite = await createBadgeSuite(NOW);
const { ctx, bucket, anonymous, signUp, setBadges, uploadImage, owned, shown, publicBadges } =
	suite;

const BADGE: Badge = { name: 'Night Owl', image: suite.images[0] };

afterAll(suite.close);

describe('badge images', () => {
	test('a $5 sponsor uploads a PNG; the same bytes again store nothing new', async () => {
		const sponsor = await signUp();
		const bytes = encodePng({ width: 96, color: [200, 80, 160] });
		const stored = bucket.objects.size;

		const first = await uploadImage(sponsor.client, bytes);
		const again = await uploadImage(sponsor.client, bytes);

		expect(first).toEqual({ image: hashBadgeImage(bytes), url: suite.imageUrl(first.image) });
		expect(again).toEqual(first);
		expect(bucket.objects.size).toBe(stored + 1);
		expect(bucket.objects.get(getBadgeImageKey(first.image))).toEqual(bytes);

		const pink = { name: 'Pink', image: first.image };

		expect((await setBadges(sponsor.client, [pink])).claim?.badges).toEqual(owned(pink));
	});

	test('uploading needs a linked, active, recurring sponsorship of at least $5', async () => {
		const bytes = encodePng({ width: 64 });
		const ineligible = await Promise.all([
			signUp({ github: false }),
			signUp({ sponsorship: { monthlyPriceCents: 499 } }),
			signUp({ sponsorship: { oneTime: true } }),
		]);

		for (const sponsor of ineligible) {
			expect(await failure(uploadImage(sponsor.client, bytes))).toEqual({
				status: 403,
				code: 'sponsorship_required',
			});
		}

		expect(await failure(uploadImage(anonymous, bytes))).toEqual({
			status: 401,
			code: 'unauthorized',
		});
	});

	test('refuses an image that breaks a rule, or another content type, and stores nothing', async () => {
		const sponsor = await signUp();
		const stored = bucket.objects.size;

		expect(await failure(uploadImage(sponsor.client, encodePng({ width: 300 })))).toEqual({
			status: 400,
			code: 'badge_rejected',
		});
		expect(
			await failure(uploadImage(sponsor.client, encodePng({ width: 64 }), 'image/jpeg')),
		).toEqual({ status: 400, code: 'badge_rejected' });
		expect(bucket.objects.size).toBe(stored);
	});

	test('refuses a badge whose image was never uploaded', async () => {
		const sponsor = await signUp();
		const unknown = hashBadgeImage(new TextEncoder().encode('never uploaded'));

		expect(
			await failure(setBadges(sponsor.client, [BADGE, { name: 'Ghost', image: unknown }])),
		).toEqual({ status: 400, code: 'badge_rejected' });
		expect(await publicBadges(sponsor.userId)).toEqual({ badges: [] });
	});

	test('caps uploads at 20 an hour per user', async () => {
		const sponsor = await signUp();
		const bytes = encodePng({ width: 64 });

		for (let i = 0; i < 20; i++) {
			await uploadImage(sponsor.client, bytes);
		}

		expect(await failure(uploadImage(sponsor.client, bytes))).toEqual({
			status: 429,
			code: 'rate_limited',
		});
	});
});

describe('badges stored before images', () => {
	const LEGACY = { label: 'Night Owl', icon: 'moon', color: 'purple' };

	async function storeLegacy(
		userId: string,
		config: typeof LEGACY | (typeof LEGACY)[],
		revoked = false,
	) {
		const [row] = await ctx.db
			.insert(perkClaim)
			.values({
				userId,
				perkId: 'custom-badge',
				config,
				createdAt: NOW,
				updatedAt: NOW,
				revokedAt: revoked ? NOW : null,
				revokeReason: revoked ? 'Old badge.' : null,
			})
			.returning();

		return row;
	}

	test('read as no badges until new ones replace them', async () => {
		const single = await signUp();
		const list = await signUp();
		const rows = [
			await storeLegacy(single.userId, LEGACY),
			await storeLegacy(list.userId, [LEGACY]),
		];

		expect(rows.map((row) => toBadgeClaim(ctx.env, row))).toEqual([null, null]);
		expect((await getVisibleBadges(ctx, [single.userId, list.userId])).size).toBe(0);

		expect((await setBadges(list.client, [BADGE])).claim?.badges).toEqual(owned(BADGE));
		expect(await publicBadges(list.userId)).toEqual(shown(BADGE));
	});

	test('a revoked one still blocks setting badges and shows its owner why', async () => {
		const sponsor = await signUp();
		const row = await storeLegacy(sponsor.userId, LEGACY, true);

		expect(toBadgeClaim(ctx.env, row)).toEqual({
			badges: [],
			revokedAt: NOW.toISOString(),
			revokeReason: 'Old badge.',
		});
		expect(await failure(setBadges(sponsor.client, [BADGE]))).toEqual({
			status: 403,
			code: 'perk_revoked',
		});

		const [stored] = await ctx.db
			.select({ config: perkClaim.config })
			.from(perkClaim)
			.where(eq(perkClaim.userId, sponsor.userId));

		expect(stored?.config).toEqual(LEGACY);
	});
});
