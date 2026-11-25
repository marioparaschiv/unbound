import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';

import MarketplaceStore from '~/marketplace/state';

/**
 * @description Reads which addon ids the Marketplace lists, loading the stored catalog on first use.
 * @returns The listed ids, or `undefined` until a catalog is available.
 */
function useListedIds(): Set<string> | undefined {
	// The catalog alone, so a refresh that changes nothing keeps the set and skips re-rendering the page.
	const catalog = useStore(MarketplaceStore, ({ state }) =>
		state.status === 'ready' ? state.catalog : undefined,
	);

	useEffect(() => {
		void MarketplaceStore.getState().load();
	}, []);

	return useMemo(
		() => (catalog ? new Set(catalog.addons.map((addon) => addon.id)) : undefined),
		[catalog],
	);
}

export default useListedIds;
