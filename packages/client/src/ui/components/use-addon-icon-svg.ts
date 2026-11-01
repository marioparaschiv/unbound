import { useEffect } from 'react';

import { findIconSvg } from '~/marketplace/catalog';
import MarketplaceStore from '~/marketplace/state';

/**
 * @description Reads the website icon an addon's maintainers picked from the stored catalog, loading
 * it once if nothing has yet, so installed cards show it before the Marketplace page is opened.
 * @param id The addon id.
 * @returns The icon's SVG markup, or `undefined` for the kind's default.
 */
function useAddonIconSvg(id: string): string | undefined {
	useEffect(() => {
		const store = MarketplaceStore.getState();

		if (store.state.status === 'idle') {
			void store.load();
		}
	}, []);

	return MarketplaceStore((store) => findIconSvg(store.state, id));
}

export default useAddonIconSvg;
