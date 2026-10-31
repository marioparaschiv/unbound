import { createLogger } from '@unbound-app/logger';
import { useEffect, useState } from 'react';

import { fetchStorePage, type StorePage } from '~/marketplace/store-page';

/** The store page's lifecycle: fetching, fetched, not on the CDN, or failed until the user retries. */
export type StorePageState =
	| { status: 'loading' }
	| { status: 'ready'; page: StorePage }
	| { status: 'missing' }
	| { status: 'failed' };

export type StorePageHandle = {
	state: StorePageState;
	/** Fetches the page again after a failure. */
	retry: () => void;
};

const logger = createLogger('Marketplace', 'Store page');

/**
 * @description Fetches a version's store page when mounted, and again on retry.
 * @param pageUrl The catalog version's `pageUrl`; `null` when the version has no page.
 * @returns The fetch's state and a way to retry it.
 */
function useStorePage(pageUrl: string | null): StorePageHandle {
	const [state, setState] = useState<StorePageState>({ status: 'loading' });
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let current = true;

		if (!pageUrl) {
			setState({ status: 'missing' });

			return;
		}

		setState({ status: 'loading' });
		fetchStorePage(pageUrl).then(
			(page) => {
				if (current) {
					setState(page ? { status: 'ready', page } : { status: 'missing' });
				}
			},
			(error) => {
				logger.error(`Failed to fetch the store page ${pageUrl}:`, error);

				if (current) {
					setState({ status: 'failed' });
				}
			},
		);

		return () => {
			current = false;
		};
	}, [pageUrl, attempt]);

	return { state, retry: () => setAttempt((count) => count + 1) };
}

export default useStorePage;
