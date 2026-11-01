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
const {
	ctx,
	bucket,
	anonymous,
	signUp,
	setBadges,
	requestUpload,
	putUpload,
	completeUpload,
	staged,
	uploadImage,
	owned,
	shown,
	publicBadges,
} = suite;

const MB = 1024 * 1024;

const BADGE: Badge = { name: 'Night Owl', image: suite.images[0] };

afterAll(suite.close);

describe('badge images', () => {
	test('a $5 sponsor uploads a PNG through a presigned URL; the same bytes again store nothing new', async () => {
		const sponsor = await signUp();
		const bytes = encodePng({ width: 96, color: [200, 80, 160], padding: 400 * 1024 });
		const stored = bucket.objects.size;

		const { uploadId, url, expiresAt } = await requestUpload(sponsor.client, bytes.byteLength);

		expect(expiresAt).toBe(new Date(NOW.getTime() + 5 * 60_000).toISOString());
		expect(bucket.objects.size).toBe(stored);

		await putUpload(url, bytes);

		const first = await completeUpload(sponsor.client, uploadId);
		const again = await uploadImage(sponsor.client, bytes);

		expect(first).toEqual({ image: hashBadgeImage(bytes), url: suite.imageUrl(first.image) });
		expect(again).toEqual(first);
		expect(await staged(url)).toBe(false);
		expect(bucket.objects.size).toBe(stored + 1);
		expect(bucket.objects.get(getBadgeImageKey(first.image))).toEqual(bytes);

		const pink = { name: 'Pink', image: first.image };

		expect((await setBadges(sponsor.client, [pink])).claim?.badges).toEqual(owned(pink));
	});

	test('uploading needs a linked, active, recurring sponsorship of at least $5', async () => {
		const ineligible = await Promise.all([
			signUp({ github: false }),
			signUp({ sponsorship: { monthlyPriceCents: 499 } }),
			signUp({ sponsorship: { oneTime: true } }),
		]);

		for (const sponsor of ineligible) {
			expect(await failure(requestUpload(sponsor.client, 1024))).toEqual({
				status: 403,
				code: 'sponsorship_required',
			});
			expect(await failure(completeUpload(sponsor.client, Bun.randomUUIDv7()))).toEqual({
				status: 403,
				code: 'sponsorship_required',
			});
		}

		expect(await failure(requestUpload(anonymous, 1024))).toEqual({
			status: 401,
			code: 'unauthorized',
		});
	});

	test('refuses a declared size over 5 MB before handing out a URL', async () => {
		const sponsor = await signUp();

		expect(await failure(requestUpload(sponsor.client, 5 * MB + 1))).toEqual({
			status: 400,
			code: 'badge_rejected',
		});
		expect((await requestUpload(sponsor.client, 5 * MB)).uploadId).toBeString();
	});

	test.each([
		['breaks a rule', encodePng({ width: 300 })],
		['is over 5 MB, whatever size was declared', encodePng({ width: 64, padding: 5 * MB })],
		['is not a PNG', new TextEncoder().encode('GIF89a')],
	])('refuses and deletes a staged file that %s, and publishes nothing', async (_name, bytes) => {
		const sponsor = await signUp();
		const stored = bucket.objects.size;
		const { uploadId, url } = await requestUpload(sponsor.client, 1024);

		await putUpload(url, bytes);

		expect(await failure(completeUpload(sponsor.client, uploadId))).toEqual({
			status: 400,
			code: 'badge_rejected',
		});
		expect(await staged(url)).toBe(false);
		expect(bucket.objects.size).toBe(stored);
	});

	test("completes only an upload that arrived, and only the caller's own", async () => {
		const owner = await signUp();
		const other = await signUp();
		const bytes = encodePng({ width: 64, color: [10, 200, 120] });
		const { uploadId, url } = await requestUpload(owner.client, bytes.byteLength);

		expect(await failure(completeUpload(owner.client, uploadId))).toEqual({
			status: 404,
			code: 'not_found',
		});

		await putUpload(url, bytes);

		expect(await failure(completeUpload(other.client, uploadId))).toEqual({
			status: 404,
			code: 'not_found',
		});
		expect(await failure(completeUpload(owner.client, 'not-a-uuid'))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
		expect(await staged(url)).toBe(true);
		expect((await completeUpload(owner.client, uploadId)).image).toBe(hashBadgeImage(bytes));
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
		const other = await signUp();

		for (let i = 0; i < 20; i++) {
			await requestUpload(sponsor.client, 1024);
		}

		expect(await failure(requestUpload(sponsor.client, 1024))).toEqual({
			status: 429,
			code: 'rate_limited',
		});
		expect((await requestUpload(other.client, 1024)).uploadId).toBeString();
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
