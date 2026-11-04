import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchUserProfilePrimaryInfo } from '~/indicators/profile';
import { patchMobileStatus } from '~/indicators/mobile-status';
import { patchMessageRow } from '~/indicators/message-row';
import { patchUserRow } from '~/indicators/member-list';
import { PLUGIN_NAME } from '~/constants';
import {
	MessageRowData,
	PresenceStore,
	SessionsStore,
	Theme,
	ThemeStore,
	UserStore,
} from '~/indicators/modules';

/**
 * @description Shows the platforms a user is online on in the member list, on profiles and in message headers, and
 * lets Discord draw the mobile status shape for idle and busy users. Patches the render of `UserRow` and
 * `UserProfilePrimaryInfo`, `generateMessageRowData` on Discord's message row module, and `isMobileOnline` on
 * `PresenceStore`. Reads `SessionsStore` and `UserStore` for the signed-in user, and `Theme` and `ThemeStore` for
 * the icon colors. Each patch reads its setting when it runs, so a switch applies at once. The Addon scope removes the patches.
 */
export function startIndicators(): void {
	if (!ensureModules(PLUGIN_NAME, { PresenceStore, SessionsStore, UserStore })) return;

	if (ensureModules(`${PLUGIN_NAME}: member list`, { Theme, ThemeStore })) {
		patchUserRow();
		recordApplied(1);
	}

	if (ensureModules(`${PLUGIN_NAME}: profiles`, { Theme, ThemeStore })) {
		patchUserProfilePrimaryInfo();
		recordApplied(1);
	}

	if (ensureModules(`${PLUGIN_NAME}: messages`, { MessageRowData })) {
		patchMessageRow();
		recordApplied(1);
	}

	patchMobileStatus();
	recordApplied(1);
}
