import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { teamQuery } from '~/queries/developers/developers';
import type { Developer } from '~/lib/developers';

type LoadStatus = 'idle' | 'loading' | 'error';

type TeamPages = {
	/** `undefined` only before the first page of any search has loaded. */
	developers: Developer[] | undefined;
	status: LoadStatus;
	hasMore: boolean;
	/** Attach to an element near the end of the list; the next page loads once it nears the viewport. */
	sentinelRef: (element: HTMLElement | null) => void;
	retry: () => void;
};

/** How far below the viewport the sentinel starts the next request. */
const PRELOAD_MARGIN = '600px';

/**
 * @description Pages through the Team page's people as a sentinel scrolls near the viewport; a new search
 * keeps the last results on screen until its own arrive.
 * @param search The search the pages are filtered by.
 * @returns The people loaded so far, the load status and the sentinel ref.
 */
function useTeamPages(search: string): TeamPages {
	const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
	const {
		data,
		isPlaceholderData,
		hasNextPage,
		isFetchingNextPage,
		isFetchNextPageError,
		fetchNextPage,
	} = useInfiniteQuery({ ...teamQuery(search), placeholderData: keepPreviousData });
	const status: LoadStatus = isFetchingNextPage
		? 'loading'
		: isFetchNextPageError
			? 'error'
			: 'idle';
	const canLoad = hasNextPage && !isPlaceholderData && status === 'idle';

	// A fresh observer reports the sentinel's current state, so a still-visible sentinel keeps loading.
	useEffect(() => {
		if (!sentinel || !canLoad) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					void fetchNextPage();
				}
			},
			{ rootMargin: `0px 0px ${PRELOAD_MARGIN} 0px` },
		);

		observer.observe(sentinel);

		return () => observer.disconnect();
	}, [sentinel, canLoad, fetchNextPage]);

	return {
		developers: data?.pages.flatMap((page) => page.developers),
		status,
		hasMore: hasNextPage,
		sentinelRef: setSentinel,
		retry: () => void fetchNextPage(),
	};
}

export type { TeamPages };

export default useTeamPages;
