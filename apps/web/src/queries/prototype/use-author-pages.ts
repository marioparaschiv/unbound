import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { AUTHOR_PAGE_SIZE } from '~/lib/prototype/author-directory';
import type { FilterOption } from '~/lib/prototype/addon-filters';
import { authorsQuery } from '~/queries/prototype/authors';

type AuthorPages = {
	options: FilterOption[];
	/** Skeleton rows to show: exactly as many as the coming page holds, so nothing shifts when it lands. */
	pending: number;
	/** How many authors match in all. */
	total: number;
	hasMore: boolean;
	loadMore: () => void;
};

/**
 * @description Pages through the author directory; a new search keeps the last results on screen until its own arrive.
 * @param enabled Whether the author list is on screen; nothing loads while it is not.
 * @param query The search the names must match.
 * @returns The loaded authors, the skeleton count, the total, and a loader for the next page.
 */
function useAuthorPages(enabled: boolean, query: string): AuthorPages {
	const { data, isPlaceholderData, isFetchingNextPage, hasNextPage, fetchNextPage } =
		useInfiniteQuery({
			...authorsQuery(query),
			enabled,
			// Replace after fetch: the previous search stays up while the new one loads, never skeletons.
			placeholderData: keepPreviousData,
		});

	const loaded = data?.pages.flatMap((page) => page.options) ?? [];
	const needle = query.trim().toLowerCase();
	// The kept results narrow to the new search at once, so typing never shows names that no longer match.
	const options = isPlaceholderData
		? loaded.filter((option) => option.label.toLowerCase().includes(needle))
		: loaded;
	const total = isPlaceholderData ? options.length : (data?.pages.at(-1)?.total ?? 0);
	const pending = !data
		? AUTHOR_PAGE_SIZE
		: isFetchingNextPage
			? Math.min(AUTHOR_PAGE_SIZE, Math.max(total - options.length, 0))
			: 0;

	return {
		options,
		pending,
		total,
		hasMore: hasNextPage && !isPlaceholderData,
		loadMore: () => {
			if (!isFetchingNextPage) {
				void fetchNextPage();
			}
		},
	};
}

export default useAuthorPages;
