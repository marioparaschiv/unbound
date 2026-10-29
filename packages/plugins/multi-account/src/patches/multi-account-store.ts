import { MultiAccountStore, Patcher } from '~/modules';

/**
 * @description Reports multi-account as available on mobile, then re-renders everything that reads the store.
 * @returns A function that removes the patch.
 */
export function patchMultiAccountStore(): () => void {
	if (typeof MultiAccountStore.getCanUseMultiAccountMobile !== 'function') {
		console.error('[Multi Account] Skipped, getCanUseMultiAccountMobile is missing.');

		return () => {};
	}

	const unpatch = Patcher.instead(MultiAccountStore, 'getCanUseMultiAccountMobile', () => true);

	MultiAccountStore.emitChange();

	return () => {
		unpatch();
		MultiAccountStore.emitChange();
	};
}
