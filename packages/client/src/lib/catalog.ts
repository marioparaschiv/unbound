import type { AddonType, CatalogResponse, ListedAddon } from '@unbound-app/contracts/addons';
import { catalogResponseSchema } from '@unbound-app/contracts/addons';

/** The marketplace snapshot kept on device: every listed addon and the revision it was served at. */
export type Catalog = CatalogResponse;

/** `name` sorts alphabetically, `updated` puts the most recently published versions first. */
export type CatalogSort = 'name' | 'updated';

export type CatalogQuery = {
	type: AddonType;
	/** Matches the name, description, authors or id, case-insensitively. */
	search?: string;
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

function parseVersion(version: string): [core: number[], prerelease: string[]] {
	const [release = ''] = version.split('+');
	const dash = release.indexOf('-');
	const core = (dash === -1 ? release : release.slice(0, dash)).split('.').map(Number);

	return [core, dash === -1 ? [] : release.slice(dash + 1).split('.')];
}

function compareIdentifiers(a: string, b: string): number {
	const numeric = /^\d+$/;

	if (numeric.test(a) && numeric.test(b)) {
		return Number(a) - Number(b);
	}

	if (numeric.test(a) !== numeric.test(b)) {
		return numeric.test(a) ? -1 : 1;
	}

	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * @description Compares two semver versions by precedence, ignoring build metadata.
 * @param a The first version.
 * @param b The second version.
 * @returns A negative number when `a` is older, positive when newer, `0` when equal.
 */
export function compareVersions(a: string, b: string): number {
	const [coreA, preA] = parseVersion(a);
	const [coreB, preB] = parseVersion(b);

	for (let i = 0; i < 3; i++) {
		const difference = (coreA[i] ?? 0) - (coreB[i] ?? 0);

		if (difference) {
			return difference;
		}
	}

	// A release sorts after its prereleases.
	if (!preA.length || !preB.length) {
		return preB.length - preA.length;
	}

	for (let i = 0, len = Math.min(preA.length, preB.length); i < len; i++) {
		const difference = compareIdentifiers(preA[i] ?? '', preB[i] ?? '');

		if (difference) {
			return difference;
		}
	}

	return preA.length - preB.length;
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
	compareVersions,
	getInstallStatus,
	reduceMarketplace,
};
