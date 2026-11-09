import { createContext } from 'react';

import type { MarketplaceFilters } from '~/marketplace/filters';
import { DEFAULT_FILTERS } from '~/marketplace/filters';

/** What the marketplace page narrows every tab by: the search text and the sheet's sort and filters. */
export type Browse = {
	search: string;
	filters: MarketplaceFilters;
};

const BrowseContext = createContext<Browse>({ search: '', filters: DEFAULT_FILTERS });

export default BrowseContext;
