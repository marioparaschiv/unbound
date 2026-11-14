/** A badge's label key and colour. */
export type Badge = { label: BadgeLabel; color: string };

/** The i18n key of a badge's label. */
export type BadgeLabel =
	| 'BADGE_NSFW'
	| 'BADGE_LOCKED'
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
	isRules: boolean;
};

/** Which badges show. */
export type BadgeOptions = {
	nsfw: boolean;
	locked: boolean;
	rules: boolean;
	type: boolean;
	oneBadge: boolean;
};

const NSFW: Badge = { label: 'BADGE_NSFW', color: '#e91e63' };
const LOCKED: Badge = { label: 'BADGE_LOCKED', color: '#80848e' };
const RULES: Badge = { label: 'BADGE_RULES', color: '#5865f2' };

const TYPE_BADGES: Partial<Record<number, Badge>> = {
	0: { label: 'BADGE_TEXT', color: '#5865f2' },
	2: { label: 'BADGE_VOICE', color: '#3ba55d' },
	5: { label: 'BADGE_ANNOUNCEMENT', color: '#faa61a' },
	10: { label: 'BADGE_THREAD', color: '#7289da' },
	11: { label: 'BADGE_THREAD', color: '#7289da' },
	12: { label: 'BADGE_PRIVATE_THREAD', color: '#7289da' },
	13: { label: 'BADGE_STAGE', color: '#5865f2' },
	14: { label: 'BADGE_DIRECTORY', color: '#faa61a' },
	15: { label: 'BADGE_FORUM', color: '#5865f2' },
	16: { label: 'BADGE_MEDIA', color: '#5865f2' },
};

/**
 * @description Lists the badges a channel row shows, in order: locked, NSFW, rules, then its type.
 * @param channel What the badges read from the channel.
 * @param options Which badges show.
 * @returns The badges, empty when none apply.
 */
export function badgesFor(channel: BadgeChannel, options: BadgeOptions): Badge[] {
	const typeBadge = channel.type === undefined ? undefined : TYPE_BADGES[channel.type];
	const badges = [
		options.locked && channel.locked && LOCKED,
		options.nsfw && channel.nsfw && NSFW,
		options.rules && channel.isRules && RULES,
		options.type && typeBadge,
	].filter((badge): badge is Badge => Boolean(badge));

	return options.oneBadge ? badges.slice(0, 1) : badges;
}

export default badgesFor;
