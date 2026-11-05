import { useMemo } from 'react';

import type { MenuTriggerProps } from '~/ui/addons/menu-trigger';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

export type Filter = 'all' | 'enabled' | 'disabled';

type FilterMenuProps = {
	value: Filter;
	counts: Record<Filter, number>;
	labels: Record<Filter, string>;
	onChange: (filter: Filter) => void;
};

const FILTERS: Filter[] = ['all', 'enabled', 'disabled'];

/**
 * @description A round more-options button whose context menu picks one filter, each item counting its plugins and
 * the picked one checked.
 */
function FilterMenu({ value, counts, labels, onChange }: FilterMenuProps) {
	const items = useMemo(
		() =>
			FILTERS.map((filter) => ({
				label: `${labels[filter]} (${counts[filter]})`,
				iconSource: filter === value ? icons['CheckmarkLargeIcon'] : undefined,
				action: () => onChange(filter),
			})),
		[value, counts, labels, onChange],
	);

	// The menu anchors to the button it renders, so the trigger props go straight onto it.
	return (
		<Discord.ContextMenu title={messages.UNBOUND_FILTER} items={items} triggerOnTap>
			{(props: MenuTriggerProps) => (
				<Discord.IconButton
					{...props}
					icon={icons['MoreHorizontalIcon'] ?? 0}
					variant='secondary'
					size='md'
					accessibilityLabel={messages.UNBOUND_FILTER}
				/>
			)}
		</Discord.ContextMenu>
	);
}

export default FilterMenu;
