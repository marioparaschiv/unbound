import type { PublicBadge } from '@unbound-app/contracts/sponsors';

/** A badge as Discord's profile badge row reads it; `iconSrc` replaces the CDN icon `icon` names. */
export type ProfileBadge = {
	id: string;
	description: string;
	icon: string;
	iconSrc: string;
};

/** A badge as Discord's badge directory and badge details sheet read it. */
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

/** A user's sponsor badges in both shapes Discord reads, in the order their profile shows them. */
export type SponsorBadges = {
	profile: ProfileBadge[];
	catalog: CatalogBadge[];
};

// Discord's own badge ids are numbers or snake_case words, so this prefix never collides with one.
const ID_PREFIX = 'unbound-sponsor-';

/**
 * @description Tells a sponsor badge's id from the ids of Discord's own badges.
 * @param id A profile badge id, or a directory badge id, which Discord keeps as a number.
 * @returns Whether the id names a sponsor badge.
 */
export function isSponsorBadgeId(id: string | number | undefined): boolean {
	return typeof id === 'string' && id.startsWith(ID_PREFIX);
}

/**
 * @description Maps a user's sponsor badges to the shapes Discord's profile and badge directory render.
 * @param badges The badges the Unbound API lists for the user, in their order.
 * @param description The text the badge details sheet shows under each badge's name.
 * @returns The badges as profile badges and as directory badges, with matching ids.
 */
export function toSponsorBadges(badges: PublicBadge[], description: string): SponsorBadges {
	const profile = badges.map((badge, index): ProfileBadge => ({
		id: `${ID_PREFIX}${index}`,
		description: badge.name,
		icon: '',
		iconSrc: badge.imageUrl,
	}));
	const catalog = profile.map((badge): CatalogBadge => ({
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

	return { profile, catalog };
}
