import { useMemo } from 'react';

import type { MarketplaceFilters, TagMatch, TagOption } from '~/marketplace/filters';
import { BottomSheets, Discord, GorhomSheet } from '~/metro/components';
import { TAG_MATCHES } from '~/marketplace/filters';
import { messages, format } from '~/i18n/api';

import useStyles from './filter-sheet.style';
import MatchControl from './match-control';
import FilterBack from './filter-back';
import TagDot from './tag-dot';

type FilterTagsProps = {
	filters: MarketplaceFilters;
	options: TagOption[];
	onChange: (patch: Partial<MarketplaceFilters>) => void;
	onBack: () => void;
};

/**
 * @description The filter sheet's Tags view: whether addons carry any, all or none of the picked tags,
 * and a checkbox per tag, with its colour, counting the addons of the tab that carry it.
 */
function FilterTags({ filters, options, onChange, onBack }: FilterTagsProps) {
	const styles = useStyles();
	const { BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;
	const picked = new Set(filters.tags);
	const labels = useMemo(
		() => [
			messages.UNBOUND_FILTER_ANY,
			messages.UNBOUND_FILTER_ALL,
			messages.UNBOUND_FILTER_NONE,
		],
		[],
	);

	function toggle(id: string) {
		const tags = picked.has(id)
			? filters.tags.filter((tag) => tag !== id)
			: [...filters.tags, id];

		onChange({ tags });
	}

	return (
		<>
			<BottomSheetTitleHeader
				title={messages.UNBOUND_TAGS}
				leading={<FilterBack onPress={onBack} />}
			/>
			<ScrollView contentContainerStyle={styles.body}>
				<MatchControl
					value={filters.tagMatch}
					matches={TAG_MATCHES}
					labels={labels}
					onChange={(tagMatch: TagMatch) => onChange({ tagMatch })}
				/>
				<Discord.TableRowGroup hasIcons>
					{options.map((option) => (
						<Discord.TableCheckboxRow
							key={option.id}
							label={option.label}
							icon={<TagDot color={option.color} />}
							subLabel={format('UNBOUND_FILTER_LISTED', { count: option.count })}
							checked={picked.has(option.id)}
							onPress={() => toggle(option.id)}
						/>
					))}
				</Discord.TableRowGroup>
			</ScrollView>
		</>
	);
}

export default FilterTags;
