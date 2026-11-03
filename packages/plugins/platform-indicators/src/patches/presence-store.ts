import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { metro, patcher } from '@unbound-app/api';

import type { PresenceFluxStore } from '~/modules';
import { skip } from '~/skip';
import { isMobileShown } from '~/platforms';

function patchLoadedPresenceStore(store: PresenceFluxStore) {
	if (typeof store.isMobileOnline !== 'function' || typeof store.getClientStatus !== 'function') {
		skip('the mobile indicator, isMobileOnline is missing');

		return;
	}

	return patcher.after(store, 'isMobileOnline', ({ args: [userId], result }) => {
		if (result || typeof userId !== 'string') return;

		return isMobileShown(store.getClientStatus(userId)) || undefined;
	});
}

/**
 * @description Makes Discord draw the mobile status shape for users on mobile whatever their status, not only while they are online.
 * @returns A function that stops waiting or removes the patch.
 */
export function patchPresenceStore(): () => void {
	return whenLoaded(metro.filters.byFluxStore('Presence'), patchLoadedPresenceStore);
}

export default patchPresenceStore;
