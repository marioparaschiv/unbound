import { z } from 'zod';

export const BADGE_NAME_MAX_LENGTH = 24;

/** Badge images are square PNGs with sides in this range, in pixels. */
export const BADGE_IMAGE_MIN_SIZE = 64;

export const BADGE_IMAGE_MAX_SIZE = 256;

/** Small, so a profile's badges load at once in Discord. */
export const BADGE_IMAGE_MAX_BYTES = 64 * 1024;

export const BADGE_IMAGE_TYPE = 'image/png';

/** The rules a badge image follows, in one line. */
export const BADGE_IMAGE_RULES = `Square PNG, ${BADGE_IMAGE_MIN_SIZE} to ${BADGE_IMAGE_MAX_SIZE} px, up to ${BADGE_IMAGE_MAX_BYTES / 1024} KB`;

/** How many badges one sponsor shows; as many as fit on a Discord profile. */
export const BADGE_LIMIT = 3;

export const perkIdSchema = z.enum(['custom-badge']);

export const badgeNameSchema = z
	.string()
	.trim()
	.min(1)
	.max(BADGE_NAME_MAX_LENGTH)
	.regex(
		/^[\p{Script=Latin}0-9][\p{Script=Latin}0-9 .,'!&+\-_:]*$/u,
		"Use Latin letters, digits, spaces and . , ' ! & + - _ : only, starting with a letter or digit.",
	);

/** A badge image: the lowercase hex SHA-256 of its PNG bytes, which also names it in storage. */
export const badgeImageSchema = z.string().regex(/^[0-9a-f]{64}$/, 'Upload the badge image first.');

/** A badge as its owner sets it: the name Discord shows when it is tapped, and its uploaded image. */
export const badgeSchema = z.object({
	name: badgeNameSchema,
	image: badgeImageSchema,
});

/** A stored badge with the URL its image loads from. */
export const ownedBadgeSchema = badgeSchema.extend({
	imageUrl: z.url(),
});

export const publicBadgeSchema = z.object({
	name: z.string(),
	imageUrl: z.url(),
	kind: perkIdSchema,
});

export const uploadBadgeImageResponseSchema = z.object({
	image: badgeImageSchema,
	url: z.url(),
});

/** A sponsor's badges, in the order their profile shows them. */
export const badgesSchema = z.array(badgeSchema).min(1).max(BADGE_LIMIT);

export const setBadgesRequestSchema = z.object({
	badges: badgesSchema,
});

/** The badges a user shows on their profile, in their order; empty when they have none or they are hidden. */
export const userBadgesResponseSchema = z.object({
	badges: z.array(publicBadgeSchema),
});

export const badgeClaimSchema = z.object({
	badges: z.array(ownedBadgeSchema),
	revokedAt: z.iso.datetime().nullable(),
	revokeReason: z.string().nullable(),
});

export const badgeClaimResponseSchema = z.object({
	claim: badgeClaimSchema.nullable(),
});

/** `pending_cancellation` sponsors stay active until the cancellation takes effect. */
export const sponsorshipStateSchema = z.enum(['active', 'pending_cancellation', 'cancelled']);

export const revokeBadgeRequestSchema = z.object({
	reason: z.string().trim().min(1).max(500),
});

export type PerkId = z.infer<typeof perkIdSchema>;
export type Badge = z.infer<typeof badgeSchema>;
export type OwnedBadge = z.infer<typeof ownedBadgeSchema>;
export type UploadBadgeImageResponse = z.infer<typeof uploadBadgeImageResponseSchema>;
export type SetBadgesRequest = z.infer<typeof setBadgesRequestSchema>;
export type PublicBadge = z.infer<typeof publicBadgeSchema>;
export type UserBadgesResponse = z.infer<typeof userBadgesResponseSchema>;
export type BadgeClaim = z.infer<typeof badgeClaimSchema>;
export type BadgeClaimResponse = z.infer<typeof badgeClaimResponseSchema>;
export type SponsorshipState = z.infer<typeof sponsorshipStateSchema>;
export type RevokeBadgeRequest = z.infer<typeof revokeBadgeRequestSchema>;

export default {
	BADGE_NAME_MAX_LENGTH,
	BADGE_IMAGE_MIN_SIZE,
	BADGE_IMAGE_MAX_SIZE,
	BADGE_IMAGE_MAX_BYTES,
	BADGE_IMAGE_TYPE,
	BADGE_IMAGE_RULES,
	BADGE_LIMIT,
	perkIdSchema,
	badgeNameSchema,
	badgeImageSchema,
	badgeSchema,
	ownedBadgeSchema,
	uploadBadgeImageResponseSchema,
	badgesSchema,
	setBadgesRequestSchema,
	publicBadgeSchema,
	userBadgesResponseSchema,
	badgeClaimSchema,
	badgeClaimResponseSchema,
	sponsorshipStateSchema,
	revokeBadgeRequestSchema,
};
