import type { BadgeVariant } from '@unbound-app/api/global';

/** A badge's label key and Discord `Badge` colour; grey when it has none. */
export type Badge = { label: BadgeLabel; variant?: BadgeVariant };

/** The i18n key of a badge's label. */
export type BadgeLabel =
	| 'BADGE_NSFW'
	| 'BADGE_LOCKED'
	| 'BADGE_PRIVATE'
	| 'BADGE_RULES'
	| 'BADGE_TEXT'
	| 'BADGE_VOICE'
	| 'BADGE_ANNOUNCEMENT'
	| 'BADGE_THREAD'
	| 'BADGE_PRIVATE_THREAD'
	| 'BADGE_STAGE'
	| 'BADGE_DIRECTORY'
	| 'BADGE_FORUM'
	| 'BADGE_MEDIA';

/** What the badges read from a channel. */
export type BadgeChannel = {
	id: string;
	type?: number;
	nsfw?: boolean;
	locked: boolean;
	private: boolean;
	isRules: boolean;
};

/** Which badges show. */
export type BadgeOptions = {
	nsfw: boolean;
	locked: boolean;
	private: boolean;
	rules: boolean;
	type: boolean;
	oneBadge: boolean;
};

const NSFW: Badge = { label: 'BADGE_NSFW', variant: 'notification' };
const LOCKED: Badge = { label: 'BADGE_LOCKED' };
const PRIVATE: Badge = { label: 'BADGE_PRIVATE', variant: 'secondary' };
const RULES: Badge = { label: 'BADGE_RULES', variant: 'primary' };

const TYPE_BADGES: Partial<Record<number, Badge>> = {
	0: { label: 'BADGE_TEXT', variant: 'secondary' },
	2: { label: 'BADGE_VOICE', variant: 'secondary' },
	5: { label: 'BADGE_ANNOUNCEMENT', variant: 'secondary' },
	10: { label: 'BADGE_THREAD', variant: 'secondary' },
	11: { label: 'BADGE_THREAD', variant: 'secondary' },
	12: { label: 'BADGE_PRIVATE_THREAD', variant: 'secondary' },
	13: { label: 'BADGE_STAGE', variant: 'secondary' },
	14: { label: 'BADGE_DIRECTORY', variant: 'secondary' },
	15: { label: 'BADGE_FORUM', variant: 'secondary' },
	16: { label: 'BADGE_MEDIA', variant: 'secondary' },
};

/**
 * @description Lists the badges a channel row shows, in order: locked, private, NSFW, rules, then its type.
 * @param channel What the badges read from the channel.
 * @param options Which badges show.
 * @returns The badges, empty when none apply.
 */
export function badgesFor(channel: BadgeChannel, options: BadgeOptions): Badge[] {
	const typeBadge = channel.type === undefined ? undefined : TYPE_BADGES[channel.type];
	const badges = [
		options.locked && channel.locked && LOCKED,
		options.private && channel.private && PRIVATE,
		options.nsfw && channel.nsfw && NSFW,
		options.rules && channel.isRules && RULES,
		options.type && typeBadge,
	].filter((badge): badge is Badge => Boolean(badge));

	return options.oneBadge ? badges.slice(0, 1) : badges;
}

export default badgesFor;
