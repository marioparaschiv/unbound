import type { AddonKind } from '@unbound-app/types/addons';
import { createContext } from 'react';

import type { MarketplaceFilters } from '~/marketplace/filters';
import { DEFAULT_FILTERS } from '~/marketplace/filters';

/** What the marketplace page narrows every tab by, the search text and the sheet's sort and filters, and the tab on screen. */
export type Browse = {
	search: string;
	filters: MarketplaceFilters;
	tab: AddonKind;
};

const BrowseContext = createContext<Browse>({
	search: '',
	filters: DEFAULT_FILTERS,
	tab: 'plugin',
});

export default BrowseContext;
