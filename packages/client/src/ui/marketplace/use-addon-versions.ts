import type { AddonVersion } from '@unbound-app/contracts/addons';
import { createLogger } from '@unbound-app/logger';
import { useEffect, useState } from 'react';

import { fetchAddonVersions } from '~/lib/addon-versions';
import { API_URL } from '~/lib/constants';

/** The version list's lifecycle: fetching, fetched, or failed until the user retries. */
export type AddonVersionsState =
	| { status: 'loading' }
	| { status: 'ready'; versions: AddonVersion[] }
	| { status: 'failed' };

export type AddonVersionsHandle = {
	state: AddonVersionsState;
	/** Fetches the list again after a failure. */
	retry: () => void;
};

const logger = createLogger('Marketplace', 'Versions');

/**
 * @description Fetches every live version of a listed addon when mounted, and again on retry.
 * @param id The addon's id.
 * @returns The fetch's state and a way to retry it.
 */
function useAddonVersions(id: string): AddonVersionsHandle {
	const [state, setState] = useState<AddonVersionsState>({ status: 'loading' });
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let current = true;

		setState({ status: 'loading' });
		fetchAddonVersions(id, { baseUrl: API_URL }).then(
			(versions) => {
				if (current) {
					setState({ status: 'ready', versions });
				}
			},
			(error) => {
				logger.error(`Failed to fetch the versions of ${id}:`, error);

				if (current) {
					setState({ status: 'failed' });
				}
			},
		);

		return () => {
			current = false;
		};
	}, [id, attempt]);

	return { state, retry: () => setAttempt((count) => count + 1) };
}

export default useAddonVersions;
