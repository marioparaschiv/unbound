import type { ListedAddon } from '@unbound-app/contracts/addons';

import type { CatalogQuery, MarketplaceListing } from '~/marketplace/catalog';
import { installVersion } from '~/marketplace/install';
import { queryCatalog } from '~/marketplace/catalog';
import MarketplaceStore from '~/marketplace/state';

export type { CatalogQuery, CatalogSort, MarketplaceListing } from '~/marketplace/catalog';

function toListing(listed: ListedAddon): MarketplaceListing {
	const { manifest, version, publishedAt } = listed.latestVersion;

	return {
		id: listed.id,
		type: listed.type,
		name: listed.name ?? manifest.name,
		description: listed.description ?? manifest.description,
		authors: manifest.authors,
		version,
		publishedAt,
	};
}

/**
 * @description Fetches the marketplace catalog if it changed. Concurrent calls share one request.
 * @returns Whether the server could be reached.
 */
export function refresh(): Promise<boolean> {
	return MarketplaceStore.getState().refresh();
}

/**
 * @description Lists the catalog's addons of one type that match a query.
 * @param query The addon type, an optional search text and the sort order.
 * @returns The matching addons, or none while the catalog has not loaded.
 */
export function search(query: CatalogQuery): MarketplaceListing[] {
	const { state } = MarketplaceStore.getState();

	if (state.status !== 'ready') {
		return [];
	}

	return queryCatalog(state.catalog.addons, query).map(toListing);
}

/**
 * @description Installs the latest version of a marketplace addon, with the plugins it depends on once the user agrees.
 * @param id The addon's id in the catalog.
 * @returns Whether the addon now runs that version.
 */
export async function install(id: string): Promise<boolean> {
	const { state, load } = MarketplaceStore.getState();

	if (state.status !== 'ready') {
		await load();
	}

	const current = MarketplaceStore.getState().state;
	const listed =
		current.status === 'ready'
			? current.catalog.addons.find((addon) => addon.id === id)
			: undefined;

	if (!listed) {
		return false;
	}

	return installVersion(listed.type, listed, listed.latestVersion);
}
