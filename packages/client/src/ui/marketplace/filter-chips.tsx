import type { AddonKind } from '@unbound-app/types/addons';
import { ScrollView } from 'react-native';
import { useMemo } from 'react';

import { DEFAULT_FILTERS, listAuthors, listTags } from '~/marketplace/filters';
import type { MarketplaceFilters } from '~/marketplace/filters';
import MarketplaceStore from '~/marketplace/state';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';

import { authorsSummary, tagsSummary, updatedSummary } from './filter-labels';
import useStyles from './filter-chips.style';

type FilterChipsProps = {
	kind: AddonKind;
	filters: MarketplaceFilters;
	onChange: (filters: MarketplaceFilters) => void;
};

type Chip = {
	field: string;
	value: string;
	clear: Partial<MarketplaceFilters>;
};

/**
 * @description The active filters under the marketplace search, one pill each, such as "Authors: V +2".
 * Tapping a pill drops its filter; Clear all drops them all. Renders nothing while no filter is set.
 */
function FilterChips({ kind, filters, onChange }: FilterChipsProps) {
	const styles = useStyles();
	const state = MarketplaceStore((store) => store.state);
	const options = useMemo(
		() => (state.status === 'ready' ? listAuthors(state.catalog.addons, kind) : []),
		[state, kind],
	);
	const tagOptions = useMemo(
		() => (state.status === 'ready' ? listTags(state.catalog.addons, kind) : []),
		[state, kind],
	);

	const tags = tagsSummary(filters, tagOptions);
	const authors = authorsSummary(filters, options);
	const updated = updatedSummary(filters);
	const chips: Chip[] = [
		...(tags ? [{ field: messages.UNBOUND_TAGS, value: tags, clear: { tags: [] } }] : []),
		...(authors
			? [{ field: messages.UNBOUND_AUTHORS, value: authors, clear: { authors: [] } }]
			: []),
		...(updated
			? [{ field: messages.UNBOUND_FILTER_UPDATED, value: updated, clear: { updated: null } }]
			: []),
	];

	if (!chips.length) return null;

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			style={styles.scroller}
			contentContainerStyle={styles.row}
		>
			{chips.map(({ field, value, clear }) => (
				<Discord.Button
					key={field}
					size='sm'
					variant='secondary'
					text={format('UNBOUND_FILTER_CHIP', { field, value })}
					icon={icons['XSmallIcon']}
					iconPosition='end'
					accessibilityLabel={format('UNBOUND_FILTER_REMOVE', { name: field })}
					onPress={() => onChange({ ...filters, ...clear })}
				/>
			))}
			{chips.length > 1 ? (
				<Discord.Button
					size='sm'
					variant='tertiary'
					text={messages.UNBOUND_FILTER_CLEAR}
					onPress={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
				/>
			) : null}
		</ScrollView>
	);
}

export default FilterChips;
