import { addonTypeSchema, listAddonsQuerySchema } from '@unbound-app/contracts/addons';
import { addonIdSchema } from '@unbound-app/contracts/manifest';
import { createServerFn } from '@tanstack/react-start';
import { Type } from '@unbound-app/contracts/schema';

import { loadMarketplacePage, type MarketplacePage } from '~/lib/marketplace-listing';
import { loadAddonPage, type MarketplaceAddonDetails } from '~/lib/marketplace-page';
import { loadFeaturedAddons, type FeaturedAddon } from '~/lib/marketplace-featured';
import { searchAuthors, type AuthorPage } from '~/lib/authors/directory';
import { listTags, type TagOption } from '~/lib/addon-tags';
import { schemaValidator } from '~/lib/schema-validator';
import { splitList } from '~/lib/addon-filters';
import { getApp } from '~/lib/app';

const listingQuery = listAddonsQuerySchema.properties;

const authorSearchSchema = Type.Object({
	type: Type.Optional(addonTypeSchema),
	q: listingQuery.q,
	/** Comma-separated Discord ids, the way the listing's `authors` takes them. */
	ids: listingQuery.authors,
	cursor: listingQuery.cursor,
});

/**
 * @description Loads one page of the public addon listing for the `/addons` tabs.
 * @returns The page's addon cards and the cursor of the next page.
 */
export const fetchMarketplacePage = createServerFn({ method: 'GET' })
	.validator(schemaValidator(listAddonsQuerySchema))
	.handler(({ data }): Promise<MarketplacePage> => loadMarketplacePage(getApp(), data));

/**
 * @description Loads today's Featured picks for one `/addons` tab.
 * @returns Up to ten cards, or none when the type lists too few addons.
 */
export const fetchFeaturedAddons = createServerFn({ method: 'GET' })
	.validator(schemaValidator(addonTypeSchema))
	.handler(({ data }): Promise<FeaturedAddon[]> => loadFeaturedAddons(getApp(), data));

/**
 * @description Lists every tag with how many listed addons of the type carry it, for the Tags filter.
 * @returns The tags in menu order.
 */
export const fetchMarketplaceTags = createServerFn({ method: 'GET' })
	.validator(schemaValidator(addonTypeSchema))
	.handler(({ data }): Promise<TagOption[]> => listTags(getApp(), data));

/**
 * @description Searches the authors of listed addons for the Author filter, one page at a time.
 * @returns The page, its next cursor and how many authors match.
 */
export const fetchMarketplaceAuthors = createServerFn({ method: 'GET' })
	.validator(schemaValidator(authorSearchSchema))
	.handler(({ data }): Promise<AuthorPage> =>
		searchAuthors(getApp(), {
			...data,
			ids: data.ids ? splitList(data.ids) : undefined,
		}),
	);

/**
 * @description Loads a listed addon's public page.
 * @returns The addon with its version history and resolved authors, or `null` when it is not listed.
 */
export const fetchMarketplaceAddon = createServerFn({ method: 'GET' })
	.validator(schemaValidator(addonIdSchema))
	.handler(
		async ({ data }): Promise<MarketplaceAddonDetails | null> =>
			(await loadAddonPage(getApp(), data)) ?? null,
	);

export default {
	fetchMarketplacePage,
	fetchFeaturedAddons,
	fetchMarketplaceTags,
	fetchMarketplaceAuthors,
	fetchMarketplaceAddon,
};
