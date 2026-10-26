import type { AddonType, AddonVersion, ListedAddon } from '@unbound-app/contracts/addons';

import type { AuthorResolver, ResolvedAuthor } from '~/lib/authors/resolve';

/** What an addon card shows. Manifests are not passed whole: their passthrough keys cannot be serialized. */
export type MarketplaceAddon = {
	id: string;
	type: AddonType;
	name: string;
	description: string;
	authors: ResolvedAuthor[];
	version: string;
	manifestUrl: string;
};

export type ListedAddonFields = Pick<ListedAddon, 'id' | 'type' | 'name' | 'description'>;

/**
 * @description Builds an addon card from a listed addon and the version it serves.
 * @param addon The addon's listing columns.
 * @param latest The version it serves.
 * @param resolve The resolver loaded for this addon's authors.
 * @returns The card.
 */
export function toMarketplaceAddon(
	addon: ListedAddonFields,
	latest: AddonVersion,
	resolve: AuthorResolver,
): MarketplaceAddon {
	return {
		id: addon.id,
		type: addon.type,
		name: addon.name ?? latest.manifest.name,
		description: addon.description ?? latest.manifest.description,
		authors: resolve(latest.manifest.authors),
		version: latest.version,
		manifestUrl: latest.manifestUrl,
	};
}

export default { toMarketplaceAddon };
