import type { ListAddonsQuery } from '@unbound-app/contracts/addons';

import { toMarketplaceAddon, type MarketplaceAddon } from '~/lib/marketplace-addon';
import { readAddonTags, type AddonTag } from '~/lib/addon-tags';
import { loadAuthors } from '~/lib/authors/resolve';
import type { AppContext } from '~/lib/context';
import { listAddons } from '~/lib/addons';

/** An addon card on the `/addons` tabs, with the tags it shows. */
export type ListingAddon = MarketplaceAddon & { tags: AddonTag[] };

export type MarketplacePage = {
	addons: ListingAddon[];
	nextCursor: string | null;
};

/**
 * @description Loads one page of the public addon listing as `/addons` cards: each listed addon with
 * its resolved authors and its tags.
 * @param ctx The application context.
 * @param query The listing's filters, sort and cursor.
 * @returns The page's addon cards and the cursor of the next page.
 */
export async function loadMarketplacePage(
	ctx: AppContext,
	query: ListAddonsQuery,
): Promise<MarketplacePage> {
	const page = await listAddons(ctx, query);
	const [resolve, tags] = await Promise.all([
		loadAuthors(
			ctx,
			page.addons.map((entry) => entry.latestVersion.manifest.authors),
		),
		readAddonTags(
			ctx,
			page.addons.map((entry) => entry.id),
		),
	]);

	return {
		addons: page.addons.map((entry) => ({
			...toMarketplaceAddon(entry, entry.latestVersion, resolve),
			tags: tags.get(entry.id) ?? [],
		})),
		nextCursor: page.nextCursor,
	};
}

export default { loadMarketplacePage };
