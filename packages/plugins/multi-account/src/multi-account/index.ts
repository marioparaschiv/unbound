import { recordApplied, recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { MultiAccountStore } from '~/multi-account/modules';

let unpatch: (() => void) | undefined;

/**
 * @description Reports multi-account as available on mobile, then re-renders everything that reads the store.
 * Patches `getCanUseMultiAccountMobile` on Discord's `MultiAccountStore`.
 */
export function startMultiAccount(): void {
	if (!ensureModules('Multi Account', { MultiAccountStore })) return;

	if (typeof MultiAccountStore.getCanUseMultiAccountMobile !== 'function') {
		recordSkip('getCanUseMultiAccountMobile is missing');
		console.error('[Multi Account] Skipped, getCanUseMultiAccountMobile is missing.');

		return;
	}

	unpatch = patcher.instead(MultiAccountStore, 'getCanUseMultiAccountMobile', () => true);
	MultiAccountStore.emitChange();

	recordApplied(1);
}

/**
 * @description Removes the patch, then tells everything that reads `MultiAccountStore` to ask again so it reads the real answer.
 * The patch goes first because the Addon scope would only remove it after `stop` returns.
 */
export function stopMultiAccount(): void {
	if (!unpatch) return;

	unpatch();
	unpatch = undefined;
	MultiAccountStore.emitChange();
}
