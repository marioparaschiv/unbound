import { useEffect, useMemo } from 'react';

import MarketplaceStore from '~/marketplace/state';

/**
 * @description Reads which addon ids the Marketplace lists, loading the stored catalog on first use.
 * @returns The listed ids, or `undefined` until a catalog is available.
 */
function useListedIds(): Set<string> | undefined {
	const state = MarketplaceStore((store) => store.state);

	useEffect(() => {
		void MarketplaceStore.getState().load();
	}, []);

	return useMemo(
		() =>
			state.status === 'ready'
				? new Set(state.catalog.addons.map((addon) => addon.id))
				: undefined,
		[state],
	);
}

export default useListedIds;
