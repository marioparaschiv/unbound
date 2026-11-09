import { useMemo, useState } from 'react';

import type { AuthorOption, FilterMatch, MarketplaceFilters } from '~/marketplace/filters';
import { Avatars, BottomSheets, Discord, GorhomSheet } from '~/metro/components';
import useAuthorUsers from '~/ui/addons/use-author-users';
import { FILTER_MATCHES } from '~/marketplace/filters';
import { messages, format } from '~/i18n/api';

import useStyles from './filter-sheet.style';
import MatchControl from './match-control';
import FilterBack from './filter-back';

type FilterAuthorsProps = {
	filters: MarketplaceFilters;
	options: AuthorOption[];
	onChange: (patch: Partial<MarketplaceFilters>) => void;
	onBack: () => void;
};

/**
 * @description The filter sheet's Authors view: whether to include or exclude the picked authors, a
 * search over them, and a checkbox per author, with their avatar, counting their addons in the tab.
 */
function FilterAuthors({ filters, options, onChange, onBack }: FilterAuthorsProps) {
	const styles = useStyles();
	const { BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;
	const { Avatar, AvatarSizes } = Avatars;
	const [query, setQuery] = useState('');
	// The Marketplace cards resolved these same authors already, so this reads the session's cache.
	const authors = useMemo(() => options.map(({ id, name }) => ({ id, name })), [options]);
	const resolved = useAuthorUsers(authors);
	const avatars = new Map(resolved.map(({ author, avatar }) => [author.id, avatar]));
	const picked = new Set(filters.authors);
	const labels = useMemo<[string, string]>(
		() => [messages.UNBOUND_FILTER_INCLUDE, messages.UNBOUND_FILTER_EXCLUDE],
		[],
	);

	const needle = query.trim().toLowerCase();
	const visible = needle
		? options.filter((option) => option.name.toLowerCase().includes(needle))
		: options;

	function toggle(id: string) {
		const authors = picked.has(id)
			? filters.authors.filter((author) => author !== id)
			: [...filters.authors, id];

		onChange({ authors });
	}

	return (
		<>
			<BottomSheetTitleHeader
				title={messages.UNBOUND_AUTHORS}
				leading={<FilterBack onPress={onBack} />}
			/>
			{/* A `scrollable` sheet scrolls only a bottom-sheet scroll view, which hands the drag between list and sheet. */}
			<ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps='handled'>
				<MatchControl
					value={filters.authorMatch}
					matches={FILTER_MATCHES}
					labels={labels}
					onChange={(authorMatch: FilterMatch) => onChange({ authorMatch })}
				/>
				<Discord.SearchBar
					size='md'
					value={query}
					onChange={setQuery}
					placeholder={format('UNBOUND_SEARCH', { type: messages.UNBOUND_AUTHORS })}
				/>
				{visible.length ? (
					<Discord.TableRowGroup hasIcons>
						{visible.map((option) => (
							<Discord.TableCheckboxRow
								key={option.id}
								label={option.name}
								icon={
									<Avatar
										source={avatars.get(option.id)}
										size={AvatarSizes.SMALL}
									/>
								}
								subLabel={format('UNBOUND_FILTER_LISTED', { count: option.count })}
								checked={picked.has(option.id)}
								onPress={() => toggle(option.id)}
							/>
						))}
					</Discord.TableRowGroup>
				) : (
					<Discord.Text variant='text-sm/medium' color='text-muted' style={styles.none}>
						{messages.UNBOUND_EMPTY_RESULTS}
					</Discord.Text>
				)}
			</ScrollView>
		</>
	);
}

export default FilterAuthors;
