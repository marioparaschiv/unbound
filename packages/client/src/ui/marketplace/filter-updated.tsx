import { View } from 'react-native';
import { useMemo } from 'react';

import type { FilterMatch, MarketplaceFilters } from '~/marketplace/filters';
import { BottomSheets, Discord } from '~/metro/components';
import { FILTER_MATCHES, UPDATED_WINDOWS } from '~/marketplace/filters';
import { messages } from '~/i18n/api';

import { windowLabel } from './filter-labels';
import useStyles from './filter-sheet.style';
import MatchControl from './match-control';
import FilterBack from './filter-back';

type FilterUpdatedProps = {
	filters: MarketplaceFilters;
	onChange: (patch: Partial<MarketplaceFilters>) => void;
	onBack: () => void;
};

const ANY_TIME = 'any';

/**
 * @description The filter sheet's Updated view: whether the newest version came within or before a
 * window, and the window, any time first.
 */
function FilterUpdated({ filters, onChange, onBack }: FilterUpdatedProps) {
	const styles = useStyles();
	const { BottomSheetTitleHeader } = BottomSheets;
	const labels = useMemo<[string, string]>(
		() => [messages.UNBOUND_FILTER_WITHIN, messages.UNBOUND_FILTER_OLDER],
		[],
	);

	function pick(value: string) {
		onChange({ updated: value === ANY_TIME ? null : Number(value) });
	}

	return (
		<>
			<BottomSheetTitleHeader
				title={messages.UNBOUND_FILTER_UPDATED}
				leading={<FilterBack onPress={onBack} />}
			/>
			<View style={styles.body}>
				<MatchControl
					value={filters.updatedMatch}
					matches={FILTER_MATCHES}
					labels={labels}
					disabled={filters.updated === null}
					onChange={(updatedMatch: FilterMatch) => onChange({ updatedMatch })}
				/>
				<Discord.TableRadioGroup
					value={filters.updated === null ? ANY_TIME : String(filters.updated)}
					onChange={pick}
				>
					<Discord.TableRadioRow
						label={messages.UNBOUND_FILTER_ANY_TIME}
						value={ANY_TIME}
					/>
					{UPDATED_WINDOWS.map((days) => (
						<Discord.TableRadioRow
							key={days}
							label={windowLabel(days)}
							value={String(days)}
						/>
					))}
				</Discord.TableRadioGroup>
			</View>
		</>
	);
}

export default FilterUpdated;
