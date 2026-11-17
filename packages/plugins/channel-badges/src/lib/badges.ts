/** A badge's label key and colour. */
/** A Discord semantic colour, so the badge follows the theme. */
export type BadgeColor =
	| 'BACKGROUND_BRAND'
	| 'STATUS_POSITIVE'
	| 'STATUS_WARNING'
	| 'STATUS_DANGER'
	| 'INTERACTIVE_MUTED'
	| 'BACKGROUND_MOD_STRONG';

export type Badge = { label: BadgeLabel; color: BadgeColor };

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

const NSFW: Badge = { label: 'BADGE_NSFW', color: 'STATUS_DANGER' };
const LOCKED: Badge = { label: 'BADGE_LOCKED', color: 'INTERACTIVE_MUTED' };
const PRIVATE: Badge = { label: 'BADGE_PRIVATE', color: 'BACKGROUND_MOD_STRONG' };
const RULES: Badge = { label: 'BADGE_RULES', color: 'BACKGROUND_BRAND' };

const TYPE_BADGES: Partial<Record<number, Badge>> = {
	0: { label: 'BADGE_TEXT', color: 'BACKGROUND_BRAND' },
	2: { label: 'BADGE_VOICE', color: 'STATUS_POSITIVE' },
	5: { label: 'BADGE_ANNOUNCEMENT', color: 'STATUS_WARNING' },
	10: { label: 'BADGE_THREAD', color: 'BACKGROUND_BRAND' },
	11: { label: 'BADGE_THREAD', color: 'BACKGROUND_BRAND' },
	12: { label: 'BADGE_PRIVATE_THREAD', color: 'BACKGROUND_BRAND' },
	13: { label: 'BADGE_STAGE', color: 'BACKGROUND_BRAND' },
	14: { label: 'BADGE_DIRECTORY', color: 'STATUS_WARNING' },
	15: { label: 'BADGE_FORUM', color: 'BACKGROUND_BRAND' },
	16: { label: 'BADGE_MEDIA', color: 'BACKGROUND_BRAND' },
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
