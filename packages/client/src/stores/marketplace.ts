import { createApiClient, NotModifiedError } from '@unbound-app/web/client';
import { catalogResponseSchema } from '@unbound-app/contracts/addons';
import { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';
import type { Api } from '@unbound-app/web/api';
import { create } from 'zustand';

import type { Catalog, MarketplaceEvent, MarketplaceState } from '~/lib/catalog';
import { parseCatalog, reduceMarketplace } from '~/lib/catalog';
import { API_URL } from '~/lib/constants';
import fs from '~/api/fs';

const logger = createLogger('Marketplace');

const CATALOG_PATH = 'Unbound/Marketplace/catalog.json';

/** A complete copy written before {@link CATALOG_PATH}, so a write torn by a crash leaves one whole file. */
const CATALOG_NEXT_PATH = 'Unbound/Marketplace/catalog.next.json';

type MarketplaceStore = {
	state: MarketplaceState;
	/** Reads the stored catalog once, then refreshes it. Later calls only refresh. */
	load: () => Promise<boolean>;
	/** Fetches the catalog if it changed. Resolves `false` when the server could not be reached. */
	refresh: () => Promise<boolean>;
};

let stored: Promise<void> | undefined;
let pending: Promise<boolean> | undefined;

async function readStored(): Promise<Catalog | undefined> {
	for (const path of [CATALOG_PATH, CATALOG_NEXT_PATH]) {
		try {
			if (!(await fs.exists(path))) {
				continue;
			}

			const catalog = parseCatalog(await fs.read(path));

			if (catalog) {
				return catalog;
			}
		} catch (error) {
			logger.warn(`Failed to read ${path}:`, error);
		}
	}

	return undefined;
}

async function store(catalog: Catalog) {
	const text = JSON.stringify(catalog);

	try {
		await fs.write(CATALOG_NEXT_PATH, text);
		await fs.write(CATALOG_PATH, text);
	} catch (error) {
		logger.error('Failed to store the catalog:', error);
	}
}

async function fetchCatalog(current: Catalog | undefined): Promise<MarketplaceEvent> {
	const request = createApiClient<Api>({ baseUrl: API_URL });

	try {
		const catalog = await request('GET /api/v1/catalog', {
			response: catalogResponseSchema,
			headers: current ? { 'If-None-Match': `"${current.revision}"` } : undefined,
		});

		await store(catalog);

		return { type: 'fetched', catalog };
	} catch (error) {
		if (error instanceof NotModifiedError) {
			return { type: 'not-modified' };
		}

		logger.error('Failed to refresh the catalog:', error);

		return { type: 'failed', error: toError(error).message };
	}
}

const MarketplaceStore = create<MarketplaceStore>((set, get) => {
	function dispatch(event: MarketplaceEvent) {
		set((prev) => ({ state: reduceMarketplace(prev.state, event) }));
	}

	return {
		state: { status: 'idle' },
		async load() {
			stored ??= readStored().then((catalog) => dispatch({ type: 'stored', catalog }));

			await stored;

			return get().refresh();
		},
		refresh() {
			// Concurrent refreshes share one request, so two writers never race on the file.
			pending ??= (async () => {
				const { state } = get();

				dispatch({ type: 'refreshing' });

				const event = await fetchCatalog(
					state.status === 'ready' ? state.catalog : undefined,
				);

				dispatch(event);

				return event.type !== 'failed';
			})().finally(() => {
				pending = undefined;
			});

			return pending;
		},
	};
});

export default MarketplaceStore;
