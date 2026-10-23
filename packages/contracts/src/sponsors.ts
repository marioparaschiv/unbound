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

/** Perks a sponsor can unlock; each id is also the `kind` of what it renders publicly. */
export const perkIdSchema = z.enum(['custom-badge']);

export const badgeIconSchema = z.enum(BADGE_ICONS);

export const badgeColorSchema = z.enum(BADGE_COLORS);

// Latin script only, so look-alike letters from other scripts cannot spell a reserved word.
export const badgeLabelSchema = z
	.string()
	.trim()
	.min(1)
	.max(BADGE_LABEL_MAX_LENGTH)
	.regex(
		/^[\p{Script=Latin}0-9][\p{Script=Latin}0-9 .,'!&+\-_:]*$/u,
		"Use Latin letters, digits, spaces and . , ' ! & + - _ : only, starting with a letter or digit.",
	);

/** A custom badge as its owner sets it. */
export const badgeSchema = z.object({
	label: badgeLabelSchema,
	icon: badgeIconSchema,
	color: badgeColorSchema,
});

export const publicBadgeSchema = badgeSchema.extend({
	kind: z.literal('custom-badge'),
});

/** The badges a user shows next to their name; empty when they have none or it is hidden. */
export const userBadgesResponseSchema = z.object({
	badges: z.array(publicBadgeSchema),
});

/** A user's badge claim, including a staff revocation, which their sponsorship cannot override. */
export const badgeClaimSchema = badgeSchema.extend({
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
	perkIdSchema,
	badgeIconSchema,
	badgeColorSchema,
	badgeLabelSchema,
	badgeSchema,
	publicBadgeSchema,
	userBadgesResponseSchema,
	badgeClaimSchema,
	badgeClaimResponseSchema,
	sponsorshipStateSchema,
	revokeBadgeRequestSchema,
};
