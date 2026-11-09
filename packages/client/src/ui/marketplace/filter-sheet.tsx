import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { useMemo, useState } from 'react';

import type { MarketplaceFilters } from '~/marketplace/filters';
import { listAuthors } from '~/marketplace/filters';
import { BottomSheets } from '~/metro/components';

import type { FilterView } from './filter-root';

import FilterAuthors from './filter-authors';
import FilterUpdated from './filter-updated';
import FilterRoot from './filter-root';

type FilterSheetProps = {
	kind: AddonKind;
	addons: ListedAddon[];
	/** The page's filters when the sheet opened; the sheet keeps its own copy from then on. */
	initial: MarketplaceFilters;
	/** Runs on every change, so the list behind the sheet narrows as the user picks. */
	onChange: (filters: MarketplaceFilters) => void;
};

/**
 * @description The marketplace's Sort & Filter sheet. Its root view picks the sort and leads to one view
 * per filter, as the website's filter menu does; every pick applies at once.
 */
function FilterSheet({ kind, addons, initial, onChange }: FilterSheetProps) {
	const { ActionSheet } = BottomSheets;
	const [filters, setFilters] = useState(initial);
	const [view, setView] = useState<FilterView>('root');
	const options = useMemo(() => listAuthors(addons, kind), [addons, kind]);

	function change(patch: Partial<MarketplaceFilters>) {
		const next = { ...filters, ...patch };

		setFilters(next);
		onChange(next);
	}

	const back = () => setView('root');

	return (
		<ActionSheet scrollable={view === 'authors'}>
			{view === 'authors' ? (
				<FilterAuthors
					filters={filters}
					options={options}
					onChange={change}
					onBack={back}
				/>
			) : view === 'updated' ? (
				<FilterUpdated filters={filters} onChange={change} onBack={back} />
			) : (
				<FilterRoot
					filters={filters}
					options={options}
					onChange={change}
					onOpen={setView}
				/>
			)}
		</ActionSheet>
	);
}

export default FilterSheet;
