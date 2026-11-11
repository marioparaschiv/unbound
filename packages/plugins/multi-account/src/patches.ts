import type { FluxStore } from '@unbound-app/api/flux';
import { flux, patcher } from '@unbound-app/api';

type MultiAccountStoreType = FluxStore & {
	getCanUseMultiAccountMobile(): boolean;
};

const MultiAccountStore = flux.getStore('MultiAccount') as MultiAccountStoreType;

/**
 * @description Reports multi-account as available on mobile, then re-renders everything that reads the store.
 * Patches `getCanUseMultiAccountMobile` on Discord's `MultiAccountStore`.
 */
export function patchMultiAccountStore(): void {
	if (typeof MultiAccountStore.getCanUseMultiAccountMobile !== 'function') {
		logger.warn('Multi-account skipped: Discord moved getCanUseMultiAccountMobile.');

		return;
	}

	patcher.instead(MultiAccountStore, 'getCanUseMultiAccountMobile', () => true);

	MultiAccountStore.emitChange();
}

/**
 * @description Tells everything that reads `MultiAccountStore` to ask again, so it reads the real answer.
 * Call it after `patcher.unpatchAll()`: the Addon scope removes patches only after `stop` returns.
 */
export function redrawMultiAccount(): void {
	MultiAccountStore.emitChange();
}
