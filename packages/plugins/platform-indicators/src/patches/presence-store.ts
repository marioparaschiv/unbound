import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';

import { PresenceStore } from '~/lib/modules';
import { isMobileShown } from '~/lib/platforms';

/**
 * @description Makes Discord draw the mobile status shape for users on mobile whatever their status, not only while they
 * are online, by patching `isMobileOnline` on Discord's `PresenceStore`.
 */
export function patchPresenceStore(): void {
	if (typeof PresenceStore.isMobileOnline !== 'function') {
		logger.warn('Mobile status skipped: Discord moved PresenceStore.isMobileOnline.');

		return;
	}

	patcher.after(PresenceStore, 'isMobileOnline', ({ args: [userId], result }) => {
		if (!settings.colorMobileIndicator || result || typeof userId !== 'string') return;

		return isMobileShown(PresenceStore.getClientStatus(userId)) || undefined;
	});
}
