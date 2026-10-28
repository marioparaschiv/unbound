import { useEffect, useRef, useState } from 'react';

import type { Developer, DevelopersPage, DevelopersQuery } from '~/lib/developers';

type FetchDevelopers = (query: DevelopersQuery) => Promise<DevelopersPage>;

type LoadStatus = 'idle' | 'loading' | 'error';

type InfiniteDevelopers = {
	developers: Developer[];
	status: LoadStatus;
	hasMore: boolean;
	/** Attach to an element near the end of the list; the next page loads once it nears the viewport. */
	sentinelRef: (element: HTMLElement | null) => void;
	retry: () => void;
};

/** How far below the viewport the sentinel starts the next request. */
const PRELOAD_MARGIN = '600px';

/**
 * @description Appends further developer pages as a sentinel element scrolls near the viewport.
 * Remount (e.g. `key` by search) to start over from a new first page.
 * @param first The page the route loader fetched.
 * @param search The search the pages are filtered by.
 * @param fetchPage Fetches the page after a cursor.
 * @returns The developers loaded so far, the load status and the sentinel ref.
 */
function useInfiniteDevelopers(
	first: DevelopersPage,
	search: string,
	fetchPage: FetchDevelopers,
): InfiniteDevelopers {
	const [developers, setDevelopers] = useState(first.developers);
	const [cursor, setCursor] = useState(first.nextCursor);
	const [status, setStatus] = useState<LoadStatus>('idle');
	const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
	const inFlight = useRef(false);

	// A fresh observer reports the sentinel's current state, so a still-visible sentinel keeps loading.
	useEffect(() => {
		if (!sentinel || !cursor || status !== 'idle') return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting || inFlight.current) return;

				inFlight.current = true;
				setStatus('loading');

				fetchPage({ search, cursor })
					.then((page) => {
						setDevelopers((prev) => [...prev, ...page.developers]);
						setCursor(page.nextCursor);
						setStatus('idle');
					})
					.catch(() => setStatus('error'))
					.finally(() => {
						inFlight.current = false;
					});
			},
			{ rootMargin: `0px 0px ${PRELOAD_MARGIN} 0px` },
		);

		observer.observe(sentinel);

		return () => observer.disconnect();
	}, [sentinel, cursor, status, search, fetchPage]);

	return {
		developers,
		status,
		hasMore: cursor !== null,
		sentinelRef: setSentinel,
		retry: () => setStatus('idle'),
	};
}

export default useInfiniteDevelopers;
