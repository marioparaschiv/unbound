import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { AddonType } from '@unbound-app/contracts/addons';
import { useEffect, useState } from 'react';

import { AUTHOR_PAGE_SIZE, authorOptions, type FilterOption } from '~/lib/addon-filters';
import { authorsQuery } from '~/queries/marketplace/authors';

type AuthorPages = {
	options: FilterOption[];
	/** Skeleton rows to show: exactly as many as the coming page holds, so nothing shifts when it lands. */
	pending: number;
	/** How many authors match in all. */
	total: number;
	hasMore: boolean;
	loadMore: () => void;
};

// Long enough to skip the keystrokes of a word being typed, short enough to feel live.
const SEARCH_DEBOUNCE_MS = 150;

/**
 * @description Pages through a listing's authors; a new search keeps the last results on screen, narrowed
 * to the new text, until its own arrive.
 * @param type The listing's addon type.
 * @param enabled Whether the author list is on screen; nothing loads while it is not.
 * @param query The search the names must match.
 * @returns The loaded authors, the skeleton count, the total, and a loader for the next page.
 */
function useAuthorPages(type: AddonType, enabled: boolean, query: string): AuthorPages {
	const needle = query.trim().toLowerCase();
	const [settled, setSettled] = useState(needle);

	useEffect(() => {
		const timer = setTimeout(() => setSettled(needle), SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(timer);
	}, [needle]);

	// Clearing the search goes back to the cached first page at once.
	const search = needle === '' ? '' : settled;
	const { data, isPlaceholderData, isFetchingNextPage, hasNextPage, fetchNextPage } =
		useInfiniteQuery({
			...authorsQuery(type, search),
			enabled,
			// Replace after fetch: the previous search stays up while the new one loads, never skeletons.
			placeholderData: keepPreviousData,
		});

	const loaded = data?.pages.flatMap((page) => authorOptions(page.authors)) ?? [];
	const stale = isPlaceholderData || search !== needle;
	// The kept results narrow to the typed text at once, so typing never shows names that no longer match.
	const options = stale
		? loaded.filter((option) => option.label.toLowerCase().includes(needle))
		: loaded;
	const total = stale ? options.length : (data?.pages.at(-1)?.total ?? 0);
	const pending = !data
		? AUTHOR_PAGE_SIZE
		: isFetchingNextPage
			? Math.min(AUTHOR_PAGE_SIZE, Math.max(total - options.length, 0))
			: 0;

	return {
		options,
		pending,
		total,
		hasMore: hasNextPage && !stale,
		loadMore: () => {
			if (!isFetchingNextPage) {
				void fetchNextPage();
			}
		},
	};
}

export default useAuthorPages;
