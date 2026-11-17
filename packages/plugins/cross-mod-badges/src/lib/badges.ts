export const BADGE_API = 'https://api.domi-btnr.dev/clientmodbadges';

export type ProfileBadge = { id: string; description: string; icon: string; iconSrc: string };

type ApiBadge = string | { name?: unknown; badge?: unknown };

type ApiResponse = Record<string, ApiBadge[] | undefined>;

function isApiResponse(value: unknown): value is ApiResponse {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @description Turns the ClientModBadges API's answer into Discord profile badges: a mod's named badges get the API's
 * icon for that name, ones with their own image keep it.
 * @param response The parsed answer for one user.
 * @param label Writes a badge's tooltip from its mod and name.
 * @returns The badges, in the API's order.
 */
export function toProfileBadges(
	response: unknown,
	label: (mod: string, name: string) => string,
): ProfileBadge[] {
	if (!isApiResponse(response)) return [];

	const badges: ProfileBadge[] = [];

	for (const [mod, list] of Object.entries(response)) {
		for (const entry of Array.isArray(list) ? list : []) {
			const name =
				typeof entry === 'string'
					? entry
					: typeof entry?.name === 'string'
						? entry.name
						: undefined;
			const image =
				typeof entry === 'object' && typeof entry?.badge === 'string'
					? entry.badge
					: name
						? `${BADGE_API}/badges/${encodeURIComponent(mod)}/${encodeURIComponent(name)}`
						: undefined;

			if (!name || !image) continue;

			badges.push({
				id: `unbound-cross-mod-${mod}-${name}`,
				description: label(mod, name),
				icon: '',
				iconSrc: image,
			});
		}
	}

	return badges;
}

export type CatalogBadge = {
	badge_id: string;
	name: string;
	description: string;
	rarity: number;
	simple_icon_url: string;
	simple_icon_raster_url: string;
	is_earnable: false;
	owned: true;
	hidden: false;
};

/**
 * @description Writes profile badges in the shape Discord's badge directory and badge details sheet read, which newer
 * builds also draw the profile's badge row from.
 * @param badges The profile badges.
 * @param description The text the details sheet shows under each badge's name.
 * @returns The badges with matching ids.
 */
export function toCatalogBadges(
	badges: readonly ProfileBadge[],
	description: string,
): CatalogBadge[] {
	return badges.map((badge) => ({
		badge_id: badge.id,
		name: badge.description,
		description,
		rarity: 1,
		simple_icon_url: badge.iconSrc,
		simple_icon_raster_url: badge.iconSrc,
		is_earnable: false,
		owned: true,
		hidden: false,
	}));
}
