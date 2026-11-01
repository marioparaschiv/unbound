import type {
	Badge,
	BadgeClaim,
	BadgeClaimResponse,
	OwnedBadge,
	PresignedBadgeUpload,
	PublicBadge,
	UploadBadgeImageResponse,
} from '@unbound-app/contracts/sponsors';
import { BADGE_IMAGE_MAX_BYTES, BADGE_IMAGE_MAX_LABEL } from '@unbound-app/contracts/sponsors';
import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { createLogger } from '@unbound-app/logger';

import {
	findBadgeImageProblem,
	getBadgeImageKey,
	hashBadgeImage,
} from '~/lib/sponsors/badge-image';
import { canClaimPerk, isPerkUnlocked, PERKS } from '~/lib/sponsors/perks';
import { getUserSponsorship, graceMs } from '~/lib/sponsors/sponsorships';
import { account, perkClaim, sponsorship, user } from '~/db/schema';
import { findBadgeNameProblem } from '~/lib/sponsors/moderation';
import { requirePermission } from '~/lib/api/caller';
import { standingOf } from '~/lib/sponsors/standing';
import { consumeRateLimit } from '~/lib/rate-limit';
import { formatPrice } from '~/lib/sponsors/price';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';
import { getCdnUrl } from '~/lib/artifacts';
import type { Env } from '~/lib/env';

const logger = createLogger('Web', 'Sponsors');

const PERK_ID = 'custom-badge';

const UPLOAD_WINDOW_SECONDS = 60 * 60;
const UPLOADS_PER_WINDOW = 20;
// Well under STAGING_ORPHAN_GRACE_SECONDS, so the sweeper never deletes an upload still in flight.
const UPLOAD_URL_TTL_SECONDS = 5 * 60;

const TOO_LARGE = `Badge images must be ${BADGE_IMAGE_MAX_LABEL} or smaller.`;

type ClaimRow = typeof perkClaim.$inferSelect;

function badgeClaimWhere(userId: string) {
	return and(eq(perkClaim.userId, userId), eq(perkClaim.perkId, PERK_ID));
}

// Configs from before badges were images (an icon, colour and label) read as no badges until replaced.
function parseBadges(row: ClaimRow): Badge[] | undefined {
	const result = PERKS[PERK_ID].config.safeParse(row.config);

	if (!result.success) {
		logger.debug(`Ignoring the unreadable ${PERK_ID} of ${row.userId}:`, result.error);

		return;
	}

	return result.data;
}

function getBadgeImageUrl(env: Env, image: string): string {
	return getCdnUrl(env, getBadgeImageKey(image));
}

function toOwnedBadge(env: Env, badge: Badge): OwnedBadge {
	return { ...badge, imageUrl: getBadgeImageUrl(env, badge.image) };
}

/**
 * @description Shapes a stored badge claim for its owner or staff. A revoked claim stays visible even
 * when its config is unreadable, so its owner sees why they cannot set badges.
 * @param env The validated environment, for image URLs.
 * @param row The claim row, if any.
 * @returns The claim, or `null` when there is none, or its config cannot be read and it is not revoked.
 */
export function toBadgeClaim(env: Env, row: ClaimRow | undefined): BadgeClaim | null {
	if (!row) return null;

	const badges = parseBadges(row);

	if (!badges && !row.revokedAt) return null;

	return {
		badges: (badges ?? []).map((badge) => toOwnedBadge(env, badge)),
		revokedAt: row.revokedAt?.toISOString() ?? null,
		revokeReason: row.revokeReason,
	};
}

/**
 * @description Reads a user's badge claim.
 * @param ctx The application context.
 * @param userId The user.
 * @returns The claim row, or `undefined`.
 */
export async function findBadgeClaim(
	ctx: AppContext,
	userId: string,
): Promise<ClaimRow | undefined> {
	const [row] = await ctx.db.select().from(perkClaim).where(badgeClaimWhere(userId));

	return row;
}

async function claimResponse(ctx: AppContext, userId: string): Promise<BadgeClaimResponse> {
	return { claim: toBadgeClaim(ctx.env, await findBadgeClaim(ctx, userId)) };
}

async function requireClaimable(ctx: AppContext, userId: string): Promise<void> {
	const { standing } = await getUserSponsorship(ctx, userId);

	if (!canClaimPerk(PERK_ID, standing)) {
		throw new ApiError(
			'sponsorship_required',
			`A monthly GitHub sponsorship of ${formatPrice(PERKS[PERK_ID].minimumMonthlyCents)} or more unlocks a custom badge.`,
		);
	}
}

async function findBadgesProblem(ctx: AppContext, badges: Badge[]): Promise<string | undefined> {
	const names = new Set<string>();

	for (const { name } of badges) {
		const problem = findBadgeNameProblem(name);

		if (problem) {
			return problem;
		}

		if (names.has(name.toLowerCase())) {
			return `You already have a badge called "${name}".`;
		}

		names.add(name.toLowerCase());
	}

	// Only images that passed the upload checks are in the bucket, so a hash nobody uploaded is refused.
	const uploaded = await Promise.all(
		badges.map(({ image }) => ctx.storage.public.exists(getBadgeImageKey(image))),
	);
	const missing = badges.find((_, index) => !uploaded[index]);

	if (missing) {
		return `Upload the image for "${missing.name}" again; it was not found.`;
	}
}

// Scoped by user, so completing an upload only ever reads the caller's own staged file.
function getBadgeUploadKey(userId: string, uploadId: string): string {
	return `badge-uploads/${userId}/${uploadId}.png`;
}

/**
 * @description Opens a badge image upload: a presigned PUT into the private staging bucket that
 * expires in minutes. Needs a sponsorship that can claim a badge, and counts against an hourly limit.
 * @param ctx The application context.
 * @param userId The uploader.
 * @param size The file's length in bytes, refused above {@link BADGE_IMAGE_MAX_BYTES}.
 * @returns The upload id to complete, the URL to PUT the PNG to, and when that URL expires.
 */
export async function createBadgeUpload(
	ctx: AppContext,
	userId: string,
	size: number,
): Promise<PresignedBadgeUpload> {
	await requireClaimable(ctx, userId);

	if (size > BADGE_IMAGE_MAX_BYTES) {
		throw new ApiError('badge_rejected', TOO_LARGE);
	}

	await consumeRateLimit(ctx, {
		key: `api:badge-image:${userId}`,
		windowSeconds: UPLOAD_WINDOW_SECONDS,
		max: UPLOADS_PER_WINDOW,
	});

	const uploadId = Bun.randomUUIDv7();
	const expiresIn = UPLOAD_URL_TTL_SECONDS;

	return {
		uploadId,
		// S3 presigned PUTs cannot bind a length, so completing checks the size of what arrived.
		url: ctx.storage.staging.presign(getBadgeUploadKey(userId, uploadId), {
			method: 'PUT',
			expiresIn,
		}),
		expiresAt: new Date(ctx.now().getTime() + expiresIn * 1000).toISOString(),
	};
}

async function readStagedBadge(staged: Bun.S3File): Promise<Uint8Array> {
	if (!(await staged.exists())) {
		throw new ApiError('not_found', 'The badge image did not arrive; upload it again.');
	}

	if ((await staged.stat()).size > BADGE_IMAGE_MAX_BYTES) {
		throw new ApiError('badge_rejected', TOO_LARGE);
	}

	return staged.bytes();
}

/**
 * @description Completes a badge image upload: checks the staged file is a square, still PNG within
 * the size limits, stores it in the public bucket under its hash, and deletes the staged file
 * whether it passed or not. The same bytes again store nothing new.
 * @param ctx The application context.
 * @param userId The uploader, whose own upload is completed.
 * @param uploadId The id {@link createBadgeUpload} returned.
 * @returns The image's hash, which a badge refers to, and its URL.
 */
export async function completeBadgeUpload(
	ctx: AppContext,
	userId: string,
	uploadId: string,
): Promise<UploadBadgeImageResponse> {
	await requireClaimable(ctx, userId);

	const staged = ctx.storage.staging.file(getBadgeUploadKey(userId, uploadId));

	try {
		const bytes = await readStagedBadge(staged);
		const problem = findBadgeImageProblem(bytes);

		if (problem) {
			throw new ApiError('badge_rejected', problem);
		}

		const image = hashBadgeImage(bytes);
		const key = getBadgeImageKey(image);

		if (!(await ctx.storage.public.exists(key))) {
			await ctx.storage.public.write(key, bytes, { type: 'image/png' });
		}

		return { image, url: getBadgeImageUrl(ctx.env, image) };
	} finally {
		// The staging sweeper removes it later if this fails.
		await staged.delete().catch((error) => {
			logger.warn(`Failed to delete badge upload ${uploadId}:`, error);
		});
	}
}

/**
 * @description Replaces the caller's custom badges. Needs an active sponsorship that unlocks them, a
 * claim staff have not revoked, distinct names that all pass moderation, and uploaded images.
 * @param ctx The application context.
 * @param userId The badge owner.
 * @param badges The badges in display order, already validated against the contract schema.
 * @returns The stored claim.
 */
export async function claimBadges(
	ctx: AppContext,
	userId: string,
	badges: Badge[],
): Promise<BadgeClaimResponse> {
	await requireClaimable(ctx, userId);

	const problem = await findBadgesProblem(ctx, badges);

	if (problem) {
		throw new ApiError('badge_rejected', problem);
	}

	const now = ctx.now();
	// One statement, so a revoke committing while it runs still wins.
	const [row] = await ctx.db
		.insert(perkClaim)
		.values({ userId, perkId: PERK_ID, config: badges, createdAt: now, updatedAt: now })
		.onConflictDoUpdate({
			target: [perkClaim.userId, perkClaim.perkId],
			set: { config: badges, updatedAt: now },
			setWhere: isNull(perkClaim.revokedAt),
		})
		.returning();

	if (!row) {
		throw new ApiError('perk_revoked', 'Staff removed your badges; they cannot be set again.');
	}

	return { claim: toBadgeClaim(ctx.env, row) };
}

/**
 * @description Removes all the caller's custom badges. A revoked claim stays, so none can be set again.
 * @param ctx The application context.
 * @param userId The badge owner.
 * @returns The claim left, which is `null` unless it was revoked.
 */
export async function removeBadges(ctx: AppContext, userId: string): Promise<BadgeClaimResponse> {
	await ctx.db.delete(perkClaim).where(and(badgeClaimWhere(userId), isNull(perkClaim.revokedAt)));

	return claimResponse(ctx, userId);
}

/**
 * @description Hides a user's custom badges and stops them setting others. Requires `perk:revoke`.
 * @param ctx The application context.
 * @param caller The staff member.
 * @param userId The badge owner.
 * @param reason Why, shown to the owner.
 * @returns The revoked claim.
 */
export async function revokeBadge(
	ctx: AppContext,
	caller: Caller,
	userId: string,
	reason: string,
): Promise<BadgeClaimResponse> {
	requirePermission(caller, { perk: ['revoke'] });

	return setRevocation(ctx, userId, {
		revokedAt: ctx.now(),
		revokedBy: caller.user.id,
		revokeReason: reason,
	});
}

/**
 * @description Lifts a revocation, showing the badges again while the owner's sponsorship unlocks it.
 * Requires `perk:revoke`.
 * @param ctx The application context.
 * @param caller The staff member.
 * @param userId The badge owner.
 * @returns The restored claim.
 */
export async function restoreBadge(
	ctx: AppContext,
	caller: Caller,
	userId: string,
): Promise<BadgeClaimResponse> {
	requirePermission(caller, { perk: ['revoke'] });

	return setRevocation(ctx, userId, { revokedAt: null, revokedBy: null, revokeReason: null });
}

async function setRevocation(
	ctx: AppContext,
	userId: string,
	revocation: Pick<ClaimRow, 'revokedAt' | 'revokedBy' | 'revokeReason'>,
): Promise<BadgeClaimResponse> {
	const updated = await ctx.db
		.update(perkClaim)
		.set(revocation)
		.where(badgeClaimWhere(userId))
		.returning();

	if (updated.length === 0) {
		throw new ApiError('not_found', `${userId} has no badges.`);
	}

	return { claim: toBadgeClaim(ctx.env, updated[0]) };
}

/**
 * @description Finds the badges to show on users' profiles: set, not revoked, owned by a user who is
 * not banned and whose linked GitHub sponsorship still unlocks them.
 * @param ctx The application context.
 * @param userIds The users.
 * @returns Each user's shown badges, in their order, by user id.
 */
export async function getVisibleBadges(
	ctx: AppContext,
	userIds: string[],
): Promise<Map<string, PublicBadge[]>> {
	const badges = new Map<string, PublicBadge[]>();

	if (userIds.length === 0) {
		return badges;
	}

	const now = ctx.now();
	const rows = await ctx.db
		.select({ claim: perkClaim, sponsorship })
		.from(perkClaim)
		.innerJoin(user, eq(user.id, perkClaim.userId))
		.innerJoin(
			account,
			and(eq(account.userId, perkClaim.userId), eq(account.providerId, 'github')),
		)
		.innerJoin(sponsorship, eq(sponsorship.githubId, account.accountId))
		.where(
			and(
				inArray(perkClaim.userId, userIds),
				eq(perkClaim.perkId, PERK_ID),
				isNull(perkClaim.revokedAt),
				or(isNull(user.banned), eq(user.banned, false), lte(user.banExpires, now)),
			),
		);

	for (const row of rows) {
		const standing = standingOf(row.sponsorship, now, graceMs(ctx.env));
		const shown = isPerkUnlocked(PERK_ID, standing) ? parseBadges(row.claim) : undefined;

		if (!shown) {
			continue;
		}

		badges.set(
			row.claim.userId,
			shown.map(({ name, image }) => ({
				name,
				imageUrl: getBadgeImageUrl(ctx.env, image),
				kind: PERK_ID,
			})),
		);
	}

	return badges;
}

export default {
	toBadgeClaim,
	findBadgeClaim,
	createBadgeUpload,
	completeBadgeUpload,
	claimBadges,
	removeBadges,
	revokeBadge,
	restoreBadge,
	getVisibleBadges,
};
