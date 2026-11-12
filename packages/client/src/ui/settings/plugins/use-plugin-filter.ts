import { useMemo, useState } from 'react';

import type { Addon } from '~/addons/addon';

import type { Filter } from './filter-menu';

function matches(addon: Addon, query: string): boolean {
	const { name, description, authors } = addon.manifest;

	return [name, description, ...(authors ?? []).map((author) => author.name)].some((text) =>
		text?.toLowerCase().includes(query),
	);
}

/**
 * @description Narrows plugins by a search query and an enabled filter, counting each filter's matches.
 * @param addons Every plugin to choose from.
 * @param initialQuery The search the page opens with.
 * @returns The query, filter and their setters, the visible plugins and each filter's count.
 */
function usePluginFilter(addons: Addon[], initialQuery = '') {
	const [query, setQuery] = useState(initialQuery);
	const [filter, setFilter] = useState<Filter>('all');

	const searched = useMemo(() => {
		const needle = query.trim().toLowerCase();

		return needle ? addons.filter((addon) => matches(addon, needle)) : addons;
	}, [addons, query]);

	// Enabled state changes without a new array, so this pass runs every render; it is a flag read per row.
	const enabled = searched.filter((addon) => addon.isEnabled());
	const disabled = searched.filter((addon) => !addon.isEnabled());
	const visible = filter === 'enabled' ? enabled : filter === 'disabled' ? disabled : searched;

	return {
		query,
		setQuery,
		filter,
		setFilter,
		visible,
		counts: { all: searched.length, enabled: enabled.length, disabled: disabled.length },
	};
}

export default usePluginFilter;
