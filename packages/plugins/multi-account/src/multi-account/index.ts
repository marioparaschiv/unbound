import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { MultiAccountStore } from '~/multi-account/modules';

/**
 * @description Reports multi-account as available on mobile, then re-renders everything that reads the store.
 * Patches `getCanUseMultiAccountMobile` on Discord's `MultiAccountStore`. The Addon scope removes the patch.
 */
export function startMultiAccount(): void {
	if (!ensureModules('Multi Account', { MultiAccountStore })) return;

	patcher.instead(MultiAccountStore, 'getCanUseMultiAccountMobile', () => true);
	MultiAccountStore.emitChange();

	recordApplied(1);
}

/**
 * @description Tells everything that reads `MultiAccountStore` to ask again, now the patch is gone.
 */
export function stopMultiAccount(): void {
	MultiAccountStore.emitChange();
}
