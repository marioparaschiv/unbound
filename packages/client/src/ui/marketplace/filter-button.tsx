import type { AddonKind } from '@unbound-app/types/addons';

import type { MarketplaceFilters } from '~/marketplace/filters';
import { countActiveFilters } from '~/marketplace/filters';
import MarketplaceStore from '~/marketplace/state';
import { Discord } from '~/metro/components';
import { ActionSheets } from '~/metro/api';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import FilterSheet from './filter-sheet';

type FilterButtonProps = {
	kind: AddonKind;
	filters: MarketplaceFilters;
	onChange: (filters: MarketplaceFilters) => void;
};

const SHEET_KEY = 'unbound-marketplace-filters';

/**
 * @description The round button beside the marketplace search that opens the Sort & Filter sheet for the
 * open tab. It turns brand-coloured while a filter narrows the list.
 */
function FilterButton({ kind, filters, onChange }: FilterButtonProps) {
	const active = countActiveFilters(filters) > 0;

	function open() {
		const { state } = MarketplaceStore.getState();

		ActionSheets.openLazy(Promise.resolve({ default: FilterSheet }), SHEET_KEY, {
			kind,
			addons: state.status === 'ready' ? state.catalog.addons : [],
			initial: filters,
			onChange,
		});
	}

	return (
		<Discord.IconButton
			icon={icons['FiltersHorizontalIcon'] ?? 0}
			variant={active ? 'primary' : 'secondary'}
			size='md'
			accessibilityLabel={messages.UNBOUND_SORT_FILTER}
			onPress={open}
		/>
	);
}

export default FilterButton;
