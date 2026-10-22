import type { AddonType, AddonVersion, Maintainer } from '@unbound-app/contracts/addons';
import { addonIdSchema, type PublishedManifest } from '@unbound-app/contracts/manifest';
import { listAddonsQuerySchema } from '@unbound-app/contracts/addons';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod/mini';

import { getAddonDetails, listAddons } from '~/lib/addons';
import app from '~/lib/app';

export type MarketplaceSearch = z.infer<typeof marketplaceSearchSchema>;

/** The `/plugins` and `/themes` URL search parameters. */
export const marketplaceSearchSchema = z.pick(listAddonsQuerySchema.def.innerType, {
	q: true,
	sort: true,
	order: true,
});

/** What an addon card shows. Manifests are not passed whole: their passthrough keys cannot be serialized. */
export type MarketplaceAddon = {
	id: string;
	type: AddonType;
	name: string;
	description: string;
	authors: PublishedManifest['authors'];
	version: string;
	manifestUrl: string;
};

export type MarketplacePage = {
	addons: MarketplaceAddon[];
	nextCursor: string | null;
};

export type MarketplaceVersion = Omit<AddonVersion, 'manifest'>;

export type MarketplaceAddonDetails = MarketplaceAddon & {
	createdAt: string;
	capabilities: string[];
	/** The oldest Unbound version the newest version runs on. */
	minClientVersion: string | null;
	/** Newest first; the first is the one installs get. */
	versions: MarketplaceVersion[];
	maintainers: Maintainer[];
};

function toMarketplaceAddon(id: string, type: AddonType, latest: AddonVersion): MarketplaceAddon {
	return {
		id,
		type,
		name: latest.manifest.name,
		description: latest.manifest.description,
		authors: latest.manifest.authors,
		version: latest.version,
		manifestUrl: latest.manifestUrl,
	};
}

/**
 * @description Loads one page of the public addon listing for `/plugins` and `/themes`.
 * @returns The page's addon cards and the cursor of the next page.
 */
export const fetchMarketplacePage = createServerFn({ method: 'GET' })
	.validator(listAddonsQuerySchema)
	.handler(async ({ data }): Promise<MarketplacePage> => {
		const page = await listAddons(app, data);

		return {
			addons: page.addons.map((entry) =>
				toMarketplaceAddon(entry.id, entry.type, entry.latestVersion),
			),
			nextCursor: page.nextCursor,
		};
	});

/**
 * @description Loads a listed addon's public page.
 * @returns The addon with its version history and maintainers, or `null` when it is not listed.
 */
export const fetchMarketplaceAddon = createServerFn({ method: 'GET' })
	.validator(addonIdSchema)
	.handler(async ({ data }): Promise<MarketplaceAddonDetails | null> => {
		const details = await getAddonDetails(app, data);
		const [latest] = details?.versions ?? [];

		if (!details || !latest) return null;

		return {
			...toMarketplaceAddon(details.id, details.type, latest),
			createdAt: details.createdAt,
			capabilities: latest.manifest.capabilities ?? [],
			minClientVersion: latest.manifest.unbound?.min ?? null,
			versions: details.versions.map(({ manifest: _manifest, ...version }) => version),
			maintainers: details.maintainers,
		};
	});

export default { marketplaceSearchSchema, fetchMarketplacePage, fetchMarketplaceAddon };
