import { createLogger } from '@unbound-app/logger';
import { useEffect, useState } from 'react';

/** What a fetch of one resource is in: in flight, fetched, absent, or failed until the user retries. */
export type ResourceState<T> =
	| { status: 'loading' }
	| { status: 'ready'; value: T }
	| { status: 'missing' }
	| { status: 'failed' };

export type ResourceHandle<T> = {
	state: ResourceState<T>;
	/** Fetches the resource again after a failure. */
	retry: () => void;
};

const logger = createLogger('Marketplace', 'Fetch');

/**
 * @description Fetches one resource whenever its key changes, and again on retry.
 * @template T The resource's type.
 * @param key What identifies the resource; `null` when there is nothing to fetch.
 * @param load Fetches a key's resource, `null` when it is absent. Must keep its identity across renders.
 * @returns The fetch's state and a way to retry it.
 */
function useResource<T>(
	key: string | null,
	load: (key: string) => Promise<T | null>,
): ResourceHandle<T> {
	const [state, setState] = useState<ResourceState<T>>({ status: 'loading' });
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let current = true;

		if (!key) {
			setState({ status: 'missing' });

			return;
		}

		setState({ status: 'loading' });
		load(key).then(
			(value) => {
				if (current) {
					setState(value ? { status: 'ready', value } : { status: 'missing' });
				}
			},
			(error) => {
				logger.error(`Failed to fetch ${key}:`, error);

				if (current) {
					setState({ status: 'failed' });
				}
			},
		);

		return () => {
			current = false;
		};
	}, [key, load, attempt]);

	return { state, retry: () => setAttempt((count) => count + 1) };
}

export default useResource;
