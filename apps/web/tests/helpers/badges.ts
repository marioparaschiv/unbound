import {
	badgeClaimResponseSchema,
	uploadBadgeImageResponseSchema,
	userBadgesResponseSchema,
} from '@unbound-app/contracts/sponsors';
import type { Badge } from '@unbound-app/contracts/sponsors';
import { eq } from 'drizzle-orm';

import { getBadgeImageKey, hashBadgeImage } from '~/lib/sponsors/badge-image';
import uploadBadgeImageEndpoint from '~/endpoints/upload-badge-image';
import listUserBadgesEndpoint from '~/endpoints/list-user-badges';
import removeMyBadgesEndpoint from '~/endpoints/remove-my-badges';
import restoreBadgeEndpoint from '~/endpoints/restore-badge';
import setMyBadgesEndpoint from '~/endpoints/set-my-badges';
import revokeBadgeEndpoint from '~/endpoints/revoke-badge';
import type { AppContext } from '~/lib/context';
import { createApiClient } from '~/api/client';
import type { Role } from '~/lib/auth/access';
import { user } from '~/db/schema';
import type { Api } from '~/api';

import type { SeededSponsorship } from './sponsors';

import { createTestContext, linkGitHub, signInWithDiscord } from './context';
import { seedSponsorship } from './sponsors';
import { withMemoryPublic } from './storage';
import { serveEndpoints } from './server';
import { encodePng } from './png';

export type SponsorOptions = {
	role?: Role;
	github?: boolean;
	sponsorship?: Omit<SeededSponsorship, 'githubId'> | null;
};

const IMAGE_COLORS: [number, number, number][] = [
	[88, 101, 242],
	[59, 165, 93],
	[250, 168, 26],
	[237, 66, 69],
];

/**
 * @description Serves the badge endpoints over a fresh database and an in-memory public bucket that
 * already holds four uploaded badge images, with helpers to sign up sponsors and call the endpoints.
 * @param now The clock the endpoints run with.
 * @returns The context, bucket, images, clients and helpers; call `close` after the tests.
 */
export async function createBadgeSuite(now: Date) {
	const base = await createTestContext();
	const { ctx, bucket } = withMemoryPublic({ ...base.ctx, now: () => now } satisfies AppContext);
	// Stored as an upload stores them, so badges can refer to them without each test uploading.
	const images = IMAGE_COLORS.map((color) => {
		const bytes = encodePng({ width: 128, color });
		const image = hashBadgeImage(bytes);

		bucket.objects.set(getBadgeImageKey(image), bytes);

		return image;
	}) as [string, string, string, string];
	const server = serveEndpoints(ctx, {
		'POST /api/v1/me/badges/images': uploadBadgeImageEndpoint,
		'GET /api/v1/users/$id/badges': listUserBadgesEndpoint,
		'PUT /api/v1/me/badges': setMyBadgesEndpoint,
		'DELETE /api/v1/me/badges': removeMyBadgesEndpoint,
		'POST /api/v1/users/$id/badge/revoke': revokeBadgeEndpoint,
		'DELETE /api/v1/users/$id/badge/revoke': restoreBadgeEndpoint,
	});
	const anonymous = createApiClient<Api>({ baseUrl: server.url.href });
	let users = 0;

	type Client = typeof anonymous;

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

	const imageUrl = (image: string) => `${ctx.env.CDN_URL}/badges/${image}.png`;
	const setBadges = (client: Client, badges: Badge[]) =>
		client('PUT /api/v1/me/badges', { body: { badges }, response: badgeClaimResponseSchema });

	return {
		ctx,
		bucket,
		images,
		anonymous,
		signUp,
		imageUrl,
		setBadges,
		/** Badges as their owner's claim returns them. */
		owned: (...badges: Badge[]) =>
			badges.map((badge) => ({ ...badge, imageUrl: imageUrl(badge.image) })),
		/** Badges as the public endpoint returns them. */
		shown: (...badges: Badge[]) => ({
			badges: badges.map(({ name, image }) => ({
				name,
				imageUrl: imageUrl(image),
				kind: 'custom-badge' as const,
			})),
		}),
		removeBadges: (client: Client) =>
			client('DELETE /api/v1/me/badges', { response: badgeClaimResponseSchema }),
		uploadImage: (client: Client, bytes: Uint8Array<ArrayBuffer>, type = 'image/png') =>
			client('POST /api/v1/me/badges/images', {
				body: new Blob([bytes]),
				headers: { 'content-type': type },
				response: uploadBadgeImageResponseSchema,
			}),
		publicBadges: (userId: string) =>
			anonymous('GET /api/v1/users/$id/badges', {
				params: { id: userId },
				response: userBadgesResponseSchema,
			}),
		close: async () => {
			await server.stop(true);
			await base.close();
		},
	};
}

export default { createBadgeSuite };
