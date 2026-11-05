import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';

import { PresenceStore } from '~/indicators/modules';
import { isMobileShown } from '~/indicators/platforms';

/**
 * @description Makes Discord draw the mobile status shape for users on mobile whatever their status, not only while they are online.
 */
export function patchMobileStatus(): void {
	patcher.after(PresenceStore, 'isMobileOnline', ({ args: [userId], result }) => {
		if (!settings.colorMobileIndicator || result || typeof userId !== 'string') return;

		return isMobileShown(PresenceStore.getClientStatus(userId)) || undefined;
	});
}
