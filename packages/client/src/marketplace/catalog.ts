import type { CatalogResponse, ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonAuthor, AddonKind } from '@unbound-app/types/addons';
import { catalogResponseSchema } from '@unbound-app/contracts/addons';

import { compareVersions } from '~/core/versions';

/** The marketplace snapshot kept on device: every listed addon and the revision it was served at. */
export type Catalog = CatalogResponse;

/** `name` sorts alphabetically, `updated` puts the most recently published versions first. */
export type CatalogSort = 'name' | 'updated';

/** What `marketplace.search` filters the catalog by. */
export type CatalogQuery = {
	/** Only addons of this kind are returned. */
	type: AddonKind;
	/** Matches the name, description, authors or id, case-insensitively. */
	search?: string;
	/** The result order; `name` when omitted. */
	sort?: CatalogSort;
};

/**
 * The marketplace's lifecycle. `loading` has no catalog yet; `ready` always has one, stale or fresh,
 * and keeps it through refreshes and failures; `failed` means nothing is stored and the fetch failed.
 */
export type MarketplaceState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'ready'; catalog: Catalog; refreshing: boolean }
	| { status: 'failed'; error: string };

export type MarketplaceEvent =
	| { type: 'stored'; catalog: Catalog | undefined }
	| { type: 'refreshing' }
	| { type: 'fetched'; catalog: Catalog }
	| { type: 'not-modified' }
	| { type: 'failed'; error: string };

/** One addon the marketplace lists, at its newest version. */
export type MarketplaceListing = {
	/** The addon's id from its manifest, which installs and updates key on. */
	id: string;
	/** Whether the addon is a plugin, theme, icon pack or font. */
	type: AddonKind;
	/** The catalog's display name, or the newest version's manifest name when the catalog has none. */
	name: string;
	/** The catalog's description, or the newest version's manifest description when the catalog has none. */
	description: string;
	/** The authors listed in the newest version's manifest. */
	authors: AddonAuthor[];
	/** The newest published version. */
	version: string;
	/** When the newest version was published, as an ISO 8601 date-time. */
	publishedAt: string;
};

/** What a marketplace card offers for an addon, judged against the installed copy. */
export type InstallStatus = 'install' | 'installed' | 'update';

const SORTERS: Record<CatalogSort, (a: ListedAddon, b: ListedAddon) => number> = {
	name: (a, b) =>
		a.latestVersion.manifest.name.localeCompare(b.latestVersion.manifest.name) ||
		a.id.localeCompare(b.id),
	updated: (a, b) =>
		b.latestVersion.publishedAt.localeCompare(a.latestVersion.publishedAt) ||
		a.id.localeCompare(b.id),
};

/**
 * @description Parses a stored or fetched catalog against the wire contract.
 * @param text The catalog JSON.
 * @returns The catalog, or `undefined` when the text is not a whole, valid catalog.
 */
export function parseCatalog(text: string): Catalog | undefined {
	try {
		const result = catalogResponseSchema.safeParse(JSON.parse(text));

		return result.success ? result.data : undefined;
	} catch {
		return undefined;
	}
}

function matches(addon: ListedAddon, needle: string): boolean {
	const { name, description, authors } = addon.latestVersion.manifest;
	const fields = [name, description, addon.id, ...authors.map((author) => author.name)];

	return fields.some((field) => field.toLowerCase().includes(needle));
}

/**
 * @description Narrows the catalog to one addon type and a search, then sorts it. Runs on device.
 * @param addons The catalog's addons.
 * @param query The type, search text and sort.
 * @returns The matching addons, sorted.
 */
export function queryCatalog(addons: ListedAddon[], query: CatalogQuery): ListedAddon[] {
	const { type, search = '', sort = 'name' } = query;
	const needle = search.trim().toLowerCase();

	return addons
		.filter((addon) => addon.type === type && (!needle || matches(addon, needle)))
		.sort(SORTERS[sort]);
}

/**
 * @description Decides what a card offers for a listed addon.
 * @param latest The catalog's newest version.
 * @param installed The installed version, or `undefined` when the addon is not installed.
 * @returns `install` when absent, `update` when the catalog is newer, `installed` otherwise.
 */
export function getInstallStatus(latest: string, installed: string | undefined): InstallStatus {
	if (installed === undefined) {
		return 'install';
	}

	return compareVersions(latest, installed) > 0 ? 'update' : 'installed';
}

/**
 * @description Looks up the website icon a listed addon's maintainers picked.
 * @param state The marketplace lifecycle; only a ready catalog has icons.
 * @param id The addon id.
 * @returns The icon's SVG markup, or `undefined` when there is no catalog, no such addon, or no icon.
 */
export function findIconSvg(state: MarketplaceState, id: string): string | undefined {
	if (state.status !== 'ready') {
		return undefined;
	}

	return state.catalog.addons.find((addon) => addon.id === id)?.iconSvg ?? undefined;
}

/**
 * @description Advances the marketplace lifecycle by one event.
 * @param state The current state.
 * @param event What happened: the stored copy was read, a refresh started, or it ended.
 * @returns The next state.
 */
export function reduceMarketplace(
	state: MarketplaceState,
	event: MarketplaceEvent,
): MarketplaceState {
	switch (event.type) {
		case 'stored':
			return event.catalog
				? { status: 'ready', catalog: event.catalog, refreshing: false }
				: { status: 'loading' };
		case 'refreshing':
			return state.status === 'ready'
				? { ...state, refreshing: true }
				: { status: 'loading' };
		case 'fetched':
			return { status: 'ready', catalog: event.catalog, refreshing: false };
		case 'not-modified':
			return state.status === 'ready' ? { ...state, refreshing: false } : state;
		case 'failed':
			return state.status === 'ready'
				? { ...state, refreshing: false }
				: { status: 'failed', error: event.error };
	}
}

export default {
	parseCatalog,
	queryCatalog,
	getInstallStatus,
	findIconSvg,
	reduceMarketplace,
};
