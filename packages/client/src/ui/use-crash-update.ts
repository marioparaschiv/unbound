import { useEffect, useState } from 'react';

import { findClientUpdate, stageClientUpdate } from '~/updates/client-update';
import { reload } from '~/native/runtime';

/** Where the crash screen's update offer stands: none, a newer client to get, or getting it. */
export type CrashUpdate = 'none' | 'available' | 'staged' | 'updating';

/** The crash screen's update offer and how to take it. */
export type CrashUpdateOffer = { state: CrashUpdate; apply: () => void };

/**
 * @description Checks once whether a newer Unbound client is published or already downloaded, so the crash screen
 * can offer it, since a newer client often fixes the crash.
 * @returns The offer's state, and `apply`, which downloads the update when needed and restarts into it.
 */
export function useCrashUpdate(): CrashUpdateOffer {
	const [state, setState] = useState<CrashUpdate>('none');

	useEffect(() => {
		let active = true;

		void findClientUpdate().then((found) => {
			if (active && found !== 'current') {
				setState(found);
			}
		});

		return () => {
			active = false;
		};
	}, []);

	function apply() {
		const staged = state === 'staged';

		setState('updating');
		void (staged ? Promise.resolve('staged' as const) : stageClientUpdate()).then((result) => {
			if (result === 'staged') {
				void reload();

				return;
			}

			setState(staged ? 'staged' : 'available');
		});
	}

	return { state, apply };
}

export default useCrashUpdate;
