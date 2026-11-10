import { addonTypeSchema, listAddonsQuerySchema } from '@unbound-app/contracts/addons';
import { addonIdSchema } from '@unbound-app/contracts/manifest';
import { createServerFn } from '@tanstack/react-start';
import { Type } from '@unbound-app/contracts/schema';

import { listTags, readAddonTags, type AddonTag, type TagOption } from '~/lib/addon-tags';
import { loadAddonPage, type MarketplaceAddonDetails } from '~/lib/marketplace-page';
import { toMarketplaceAddon, type MarketplaceAddon } from '~/lib/marketplace-addon';
import { searchAuthors, type AuthorPage } from '~/lib/authors/directory';
import { schemaValidator } from '~/lib/schema-validator';
import { loadAuthors } from '~/lib/authors/resolve';
import { splitList } from '~/lib/addon-filters';
import { listAddons } from '~/lib/addons';
import app from '~/lib/app';

const listingQuery = listAddonsQuerySchema.properties;

const authorSearchSchema = Type.Object({
	type: Type.Optional(addonTypeSchema),
	q: listingQuery.q,
	/** Comma-separated Discord ids, the way the listing's `authors` takes them. */
	ids: listingQuery.authors,
	cursor: listingQuery.cursor,
});

/** An addon card on the `/addons` tabs, with the tags it shows. */
export type ListingAddon = MarketplaceAddon & { tags: AddonTag[] };

export type MarketplacePage = {
	addons: ListingAddon[];
	nextCursor: string | null;
};

/**
 * @description Loads one page of the public addon listing for the `/addons` tabs.
 * @returns The page's addon cards and the cursor of the next page.
 */
export const fetchMarketplacePage = createServerFn({ method: 'GET' })
	.validator(schemaValidator(listAddonsQuerySchema))
	.handler(async ({ data }): Promise<MarketplacePage> => {
		const page = await listAddons(app, data);
		const [resolve, tags] = await Promise.all([
			loadAuthors(
				app,
				page.addons.map((entry) => entry.latestVersion.manifest.authors),
			),
			readAddonTags(
				app,
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
	});

/**
 * @description Lists every tag with how many listed addons of the type carry it, for the Tags filter.
 * @returns The tags in menu order.
 */
export const fetchMarketplaceTags = createServerFn({ method: 'GET' })
	.validator(schemaValidator(addonTypeSchema))
	.handler(({ data }): Promise<TagOption[]> => listTags(app, data));

/**
 * @description Searches the authors of listed addons for the Author filter, one page at a time.
 * @returns The page, its next cursor and how many authors match.
 */
export const fetchMarketplaceAuthors = createServerFn({ method: 'GET' })
	.validator(schemaValidator(authorSearchSchema))
	.handler(({ data }): Promise<AuthorPage> =>
		searchAuthors(app, {
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
			(await loadAddonPage(app, data)) ?? null,
	);

export default {
	fetchMarketplacePage,
	fetchMarketplaceTags,
	fetchMarketplaceAuthors,
	fetchMarketplaceAddon,
};
