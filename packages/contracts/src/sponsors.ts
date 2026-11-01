import { z } from 'zod';

export const BADGE_ICONS = [
	'heart',
	'star',
	'sparkles',
	'bolt',
	'flame',
	'crown',
	'rocket',
	'code',
	'palette',
	'music',
	'coffee',
	'moon',
] as const;

export const BADGE_COLORS = [
	'pink',
	'red',
	'orange',
	'yellow',
	'green',
	'teal',
	'blue',
	'purple',
	'gray',
] as const;

export const BADGE_LABEL_MAX_LENGTH = 24;

/** How many badges one sponsor shows; as many as fit on a Discord profile. */
export const BADGE_LIMIT = 3;

export const perkIdSchema = z.enum(['custom-badge']);

export const badgeIconSchema = z.enum(BADGE_ICONS);

export const badgeColorSchema = z.enum(BADGE_COLORS);

export const badgeLabelSchema = z
	.string()
	.trim()
	.min(1)
	.max(BADGE_LABEL_MAX_LENGTH)
	.regex(
		/^[\p{Script=Latin}0-9][\p{Script=Latin}0-9 .,'!&+\-_:]*$/u,
		"Use Latin letters, digits, spaces and . , ' ! & + - _ : only, starting with a letter or digit.",
	);

export const badgeSchema = z.object({
	label: badgeLabelSchema,
	icon: badgeIconSchema,
	color: badgeColorSchema,
});

export const publicBadgeSchema = badgeSchema.extend({
	kind: perkIdSchema,
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
	badges: z.array(badgeSchema),
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

export type BadgeIcon = z.infer<typeof badgeIconSchema>;
export type BadgeColor = z.infer<typeof badgeColorSchema>;
export type PerkId = z.infer<typeof perkIdSchema>;
export type Badge = z.infer<typeof badgeSchema>;
export type SetBadgesRequest = z.infer<typeof setBadgesRequestSchema>;
export type PublicBadge = z.infer<typeof publicBadgeSchema>;
export type UserBadgesResponse = z.infer<typeof userBadgesResponseSchema>;
export type BadgeClaim = z.infer<typeof badgeClaimSchema>;
export type BadgeClaimResponse = z.infer<typeof badgeClaimResponseSchema>;
export type SponsorshipState = z.infer<typeof sponsorshipStateSchema>;
export type RevokeBadgeRequest = z.infer<typeof revokeBadgeRequestSchema>;

export default {
	BADGE_ICONS,
	BADGE_COLORS,
	BADGE_LABEL_MAX_LENGTH,
	BADGE_LIMIT,
	perkIdSchema,
	badgeIconSchema,
	badgeColorSchema,
	badgeLabelSchema,
	badgeSchema,
	badgesSchema,
	setBadgesRequestSchema,
	publicBadgeSchema,
	userBadgesResponseSchema,
	badgeClaimSchema,
	badgeClaimResponseSchema,
	sponsorshipStateSchema,
	revokeBadgeRequestSchema,
};
