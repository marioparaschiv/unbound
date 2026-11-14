import { pickFeatured } from '@unbound-app/contracts/featured-addons';
import type { AddonType } from '@unbound-app/contracts/addons';

import type { MarketplaceAddon } from '~/lib/marketplace-addon';
import { listListedAddons } from '~/lib/addons';
import type { AppContext } from '~/lib/context';

/** A card on a listing tab's Featured shelf: the addon's icon, name and description. */
export type FeaturedAddon = Pick<
	MarketplaceAddon,
	'id' | 'type' | 'name' | 'description' | 'iconSvg'
>;

/**
 * @description Loads today's Featured picks for one listing tab, the same ones the client's marketplace shows.
 * @param ctx The application context.
 * @param type The tab's addon type.
 * @returns Up to ten cards; none when the type lists too few addons for a shelf.
 */
export async function loadFeaturedAddons(
	ctx: AppContext,
	type: AddonType,
): Promise<FeaturedAddon[]> {
	const listed = await listListedAddons(ctx, type);

	return pickFeatured(listed, type, ctx.now().getTime()).map((entry) => ({
		id: entry.id,
		type: entry.type,
		name: entry.name ?? entry.latestVersion.manifest.name,
		description: entry.description ?? entry.latestVersion.manifest.description,
		iconSvg: entry.iconSvg ?? null,
	}));
}

export default { loadFeaturedAddons };
