export type ProfileBadge = { id: string; description?: string; icon?: string };

export type BadgeIcon = { source: string; name: string; size: number; alt: string };

const BADGE_ICON_URL = 'https://cdn.discordapp.com/badge-icons';
const ICON_SIZE = 18;

/**
 * @description Picks the badge to show beside a name: the first one Discord lists that the user did not hide.
 * @param badges The profile's badges, in Discord's order.
 * @param hidden Badge ids never to show.
 * @returns The role-icon row value for it, or `undefined` when no badge is left.
 */
export function badgeIcon(
	badges: readonly ProfileBadge[] | undefined,
	hidden: readonly string[],
): BadgeIcon | undefined {
	const badge = badges?.find((candidate) => candidate.icon && !hidden.includes(candidate.id));

	if (!badge?.icon) return undefined;

	const name = badge.description ?? badge.id;

	return { source: `${BADGE_ICON_URL}/${badge.icon}.png`, name, size: ICON_SIZE, alt: name };
}

export default { badgeIcon };
