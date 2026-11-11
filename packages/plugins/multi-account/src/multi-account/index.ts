import { skipFeature } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { MultiAccountStore } from '~/multi-account/modules';

/**
 * @description Reports multi-account as available on mobile, then re-renders everything that reads the store.
 * Patches `getCanUseMultiAccountMobile` on Discord's `MultiAccountStore`.
 * @returns A function that removes the patch, then tells everything that reads `MultiAccountStore` to ask again so it
 * reads the real answer. The patch goes first because the Addon scope would only remove it after `stop` returns.
 */
export function startMultiAccount(): (() => void) | undefined {
	if (!ensureModules({ MultiAccountStore })) return;

	if (typeof MultiAccountStore.getCanUseMultiAccountMobile !== 'function') {
		skipFeature('getCanUseMultiAccountMobile is missing');

		return;
	}

	const unpatch = patcher.instead(MultiAccountStore, 'getCanUseMultiAccountMobile', () => true);

	MultiAccountStore.emitChange();

	return () => {
		unpatch();
		MultiAccountStore.emitChange();
	};
}
