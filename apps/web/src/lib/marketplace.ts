import { listAddonsQuerySchema, type AddonVersion } from '@unbound-app/contracts/addons';
import type { RepositoryDetails, SourcePin } from '@unbound-app/contracts/source';
import { addonIdSchema } from '@unbound-app/contracts/manifest';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod/mini';

import { toMarketplaceAddon, type MarketplaceAddon } from '~/lib/marketplace-addon';
import { getAddonDetails, listAddons } from '~/lib/addons';
import { loadAuthors } from '~/lib/authors/resolve';
import app from '~/lib/app';

export type MarketplaceSearch = z.infer<typeof marketplaceSearchSchema>;

/** The `/plugins` and `/themes` URL search parameters. */
export const marketplaceSearchSchema = z.pick(listAddonsQuerySchema.def.innerType, {
	q: true,
	sort: true,
	order: true,
});

export type MarketplacePage = {
	addons: MarketplaceAddon[];
	nextCursor: string | null;
};

export type MarketplaceVersion = Omit<AddonVersion, 'manifest'>;

/** Where the newest version was read from, and what it and GitHub said about it at submission. */
export type MarketplaceSource = {
	pin: SourcePin;
	details: RepositoryDetails;
	addonMd: string | null;
	/** When the version was approved, which dates the `details` snapshot. */
	approvedAt: string;
};

export type MarketplaceAddonDetails = MarketplaceAddon & {
	createdAt: string;
	capabilities: string[];
	/** The oldest Unbound version the newest version runs on. */
	minClientVersion: string | null;
	/** Newest first; the first is the one installs get. */
	versions: MarketplaceVersion[];
	/** `null` when the newest version predates GitHub sources. */
	source: MarketplaceSource | null;
};

/**
 * @description Loads one page of the public addon listing for `/plugins` and `/themes`.
 * @returns The page's addon cards and the cursor of the next page.
 */
export const fetchMarketplacePage = createServerFn({ method: 'GET' })
	.validator(listAddonsQuerySchema)
	.handler(async ({ data }): Promise<MarketplacePage> => {
		const page = await listAddons(app, data);
		const resolve = await loadAuthors(
			app,
			page.addons.map((entry) => entry.latestVersion.manifest.authors),
		);

		return {
			addons: page.addons.map((entry) =>
				toMarketplaceAddon(entry, entry.latestVersion, resolve),
			),
			nextCursor: page.nextCursor,
		};
	});

/**
 * @description Loads a listed addon's public page.
 * @returns The addon with its version history and resolved authors, or `null` when it is not listed.
 */
export const fetchMarketplaceAddon = createServerFn({ method: 'GET' })
	.validator(addonIdSchema)
	.handler(async ({ data }): Promise<MarketplaceAddonDetails | null> => {
		const details = await getAddonDetails(app, data);
		const [latest] = details?.versions ?? [];

		if (!details || !latest) return null;

		const resolve = await loadAuthors(app, [latest.manifest.authors]);

		return {
			...toMarketplaceAddon(details, latest, resolve),
			createdAt: details.createdAt,
			capabilities: latest.manifest.capabilities ?? [],
			minClientVersion: latest.manifest.unbound?.min ?? null,
			versions: details.versions.map(({ manifest: _manifest, ...version }) => version),
			source:
				latest.source && details.details
					? {
							pin: latest.source,
							details: details.details,
							addonMd: details.addonMd,
							approvedAt: latest.publishedAt,
						}
					: null,
		};
	});

export default { marketplaceSearchSchema, fetchMarketplacePage, fetchMarketplaceAddon };
