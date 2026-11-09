import { View } from 'react-native';

import type { AuthorOption, MarketplaceFilters } from '~/marketplace/filters';
import { countActiveFilters, DEFAULT_FILTERS } from '~/marketplace/filters';
import { BottomSheets, Discord } from '~/metro/components';
import type { CatalogSort } from '~/marketplace/catalog';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import { authorsSummary, sortLabel, SORTS, updatedSummary } from './filter-labels';
import useStyles from './filter-sheet.style';

export type FilterView = 'root' | 'authors' | 'updated';

type FilterRootProps = {
	filters: MarketplaceFilters;
	options: AuthorOption[];
	onChange: (patch: Partial<MarketplaceFilters>) => void;
	onOpen: (view: FilterView) => void;
};

/**
 * @description The filter sheet's first view: the sort as radio rows, then a row per filter summing up
 * what it picks and opening its own view. Reset appears once anything differs from the defaults.
 */
function FilterRoot({ filters, options, onChange, onOpen }: FilterRootProps) {
	const styles = useStyles();
	const { BottomSheetTitleHeader } = BottomSheets;
	const changed = countActiveFilters(filters) > 0 || filters.sort !== DEFAULT_FILTERS.sort;

	return (
		<>
			<BottomSheetTitleHeader
				title={messages.UNBOUND_SORT_FILTER}
				trailing={
					changed ? (
						<Discord.Button
							size='sm'
							variant='tertiary'
							text={messages.UNBOUND_RESET}
							onPress={() => onChange(DEFAULT_FILTERS)}
						/>
					) : null
				}
			/>
			<View style={styles.body}>
				<Discord.TableRadioGroup
					title={messages.UNBOUND_SORT_BY}
					value={filters.sort}
					onChange={(sort: CatalogSort) => onChange({ sort })}
				>
					{SORTS.map((sort) => (
						<Discord.TableRadioRow key={sort} label={sortLabel(sort)} value={sort} />
					))}
				</Discord.TableRadioGroup>
				<Discord.TableRowGroup title={messages.UNBOUND_FILTER}>
					<Discord.TableRow
						label={messages.UNBOUND_AUTHORS}
						icon={<Discord.TableRowIcon source={icons['UserIcon'] ?? 0} />}
						trailing={
							<Discord.TableRow.TrailingText
								text={
									authorsSummary(filters, options) ?? messages.UNBOUND_FILTER_ANY
								}
							/>
						}
						arrow
						onPress={() => onOpen('authors')}
					/>
					<Discord.TableRow
						label={messages.UNBOUND_FILTER_UPDATED}
						icon={<Discord.TableRowIcon source={icons['ClockIcon'] ?? 0} />}
						trailing={
							<Discord.TableRow.TrailingText
								text={updatedSummary(filters) ?? messages.UNBOUND_FILTER_ANY_TIME}
							/>
						}
						arrow
						onPress={() => onOpen('updated')}
					/>
				</Discord.TableRowGroup>
			</View>
		</>
	);
}

export default FilterRoot;
