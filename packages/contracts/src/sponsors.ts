import { Type, type Static, trimmedString } from './schema';

export const BADGE_NAME_MAX_LENGTH = 24;

/** Badge images are square PNGs with sides in this range, in pixels. */
export const BADGE_IMAGE_MIN_SIZE = 64;

export const BADGE_IMAGE_MAX_SIZE = 256;

export const BADGE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** {@link BADGE_IMAGE_MAX_BYTES} as every message and hint shows it. */
export const BADGE_IMAGE_MAX_LABEL = `${BADGE_IMAGE_MAX_BYTES / 1024 / 1024} MB`;

export const BADGE_IMAGE_TYPE = 'image/png';

/** The rules a badge image follows, in one line. */
export const BADGE_IMAGE_RULES = `Square PNG, ${BADGE_IMAGE_MIN_SIZE} to ${BADGE_IMAGE_MAX_SIZE} px, up to ${BADGE_IMAGE_MAX_LABEL}`;

/** How many badges one sponsor shows; as many as fit on a Discord profile. */
export const BADGE_LIMIT = 3;

export const perkIdSchema = Type.Enum(['custom-badge']);

const BADGE_NAME_PATTERN = /^[\p{Script=Latin}0-9][\p{Script=Latin}0-9 .,'!&+\-_:]*$/u;

export const badgeNameSchema = trimmedString(
	(value) => (value.length < 1 ? 'Too small: expected string to have >=1 characters' : undefined),
	(value) =>
		value.length > BADGE_NAME_MAX_LENGTH
			? `Too big: expected string to have <=${BADGE_NAME_MAX_LENGTH} characters`
			: undefined,
	(value) =>
		BADGE_NAME_PATTERN.test(value)
			? undefined
			: "Use Latin letters, digits, spaces and . , ' ! & + - _ : only, starting with a letter or digit.",
);

/** A badge image: the lowercase hex SHA-256 of its PNG bytes, which also names it in storage. */
export const badgeImageSchema = Type.String({
	pattern: /^[0-9a-f]{64}$/,
	errorMessage: 'Upload the badge image first.',
});

/** A badge as its owner sets it: the name Discord shows when it is tapped, and its uploaded image. */
export const badgeSchema = Type.Object({
	name: badgeNameSchema,
	image: badgeImageSchema,
});

/** A stored badge with the URL its image loads from. */
export const ownedBadgeSchema = Type.Object({
	...badgeSchema.properties,
	imageUrl: Type.String({ format: 'url' }),
});

export const publicBadgeSchema = Type.Object({
	name: Type.String(),
	imageUrl: Type.String({ format: 'url' }),
	kind: perkIdSchema,
});

/** Asks for a presigned upload of a badge image; `size` is the file's length in bytes. */
export const createBadgeUploadRequestSchema = Type.Object({
	size: Type.Integer({ exclusiveMinimum: 0 }),
});

/** A short-lived presigned PUT the browser sends the PNG to, then completes by `uploadId`. */
export const presignedBadgeUploadSchema = Type.Object({
	uploadId: Type.String({ format: 'uuid' }),
	url: Type.String({ format: 'url' }),
	expiresAt: Type.String({ format: 'date-time' }),
});

/** A completed upload: the stored image's hash and its URL. */
export const uploadBadgeImageResponseSchema = Type.Object({
	image: badgeImageSchema,
	url: Type.String({ format: 'url' }),
});

/** A sponsor's badges, in the order their profile shows them. */
export const badgesSchema = Type.Array(badgeSchema, {
	minItems: 1,
	maxItems: BADGE_LIMIT,
});

export const setBadgesRequestSchema = Type.Object({
	badges: badgesSchema,
});

/** The badges a user shows on their profile, in their order; empty when they have none or they are hidden. */
export const userBadgesResponseSchema = Type.Object({
	badges: Type.Array(publicBadgeSchema),
});

export const badgeClaimSchema = Type.Object({
	badges: Type.Array(ownedBadgeSchema),
	revokedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
	revokeReason: Type.Union([Type.String(), Type.Null()]),
});

export const badgeClaimResponseSchema = Type.Object({
	claim: Type.Union([badgeClaimSchema, Type.Null()]),
});

/** `pending_cancellation` sponsors stay active until the cancellation takes effect. */
export const sponsorshipStateSchema = Type.Enum(['active', 'pending_cancellation', 'cancelled']);

export const revokeBadgeRequestSchema = Type.Object({
	reason: trimmedString(
		(value) =>
			value.length < 1 ? 'Too small: expected string to have >=1 characters' : undefined,
		(value) =>
			value.length > 500 ? 'Too big: expected string to have <=500 characters' : undefined,
	),
});

export type PerkId = Static<typeof perkIdSchema>;
export type Badge = Static<typeof badgeSchema>;
export type OwnedBadge = Static<typeof ownedBadgeSchema>;
export type CreateBadgeUploadRequest = Static<typeof createBadgeUploadRequestSchema>;
export type PresignedBadgeUpload = Static<typeof presignedBadgeUploadSchema>;
export type UploadBadgeImageResponse = Static<typeof uploadBadgeImageResponseSchema>;
export type SetBadgesRequest = Static<typeof setBadgesRequestSchema>;
export type PublicBadge = Static<typeof publicBadgeSchema>;
export type UserBadgesResponse = Static<typeof userBadgesResponseSchema>;
export type BadgeClaim = Static<typeof badgeClaimSchema>;
export type BadgeClaimResponse = Static<typeof badgeClaimResponseSchema>;
export type SponsorshipState = Static<typeof sponsorshipStateSchema>;
export type RevokeBadgeRequest = Static<typeof revokeBadgeRequestSchema>;

export default {
	BADGE_NAME_MAX_LENGTH,
	BADGE_IMAGE_MIN_SIZE,
	BADGE_IMAGE_MAX_SIZE,
	BADGE_IMAGE_MAX_BYTES,
	BADGE_IMAGE_MAX_LABEL,
	BADGE_IMAGE_TYPE,
	BADGE_IMAGE_RULES,
	BADGE_LIMIT,
	perkIdSchema,
	badgeNameSchema,
	badgeImageSchema,
	badgeSchema,
	ownedBadgeSchema,
	createBadgeUploadRequestSchema,
	presignedBadgeUploadSchema,
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
