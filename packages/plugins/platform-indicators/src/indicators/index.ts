import { recordApplied, recordFailure, recordSkip } from '@unbound-plugins/shared/lifecycle/health';
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
 * the icon colors. Each patch reads its setting when it runs, so a switch applies at once. A feature that throws on start
 * is logged and recorded, and the others still start. The Addon scope removes the patches.
 */
export function startIndicators(): void {
	if (!ensureModules(PLUGIN_NAME, { PresenceStore, SessionsStore, UserStore })) return;

	const failed: string[] = [];
	let applied = 0;

	function startFeature(name: string, start: () => void): void {
		try {
			start();
			applied++;
		} catch (error) {
			failed.push(name);
			console.error(`[${PLUGIN_NAME}] Failed to start ${name}:`, error);
		}
	}

	if (ensureModules(`${PLUGIN_NAME}: member list`, { Theme, ThemeStore })) {
		startFeature('member list', patchUserRow);
	}

	if (ensureModules(`${PLUGIN_NAME}: profiles`, { Theme, ThemeStore })) {
		startFeature('profiles', patchUserProfilePrimaryInfo);
	}

	if (ensureModules(`${PLUGIN_NAME}: messages`, { MessageRowData })) {
		startFeature('messages', patchMessageRow);
	}

	if (typeof PresenceStore.isMobileOnline === 'function') {
		startFeature('mobile status', patchMobileStatus);
	} else {
		recordSkip(`${PLUGIN_NAME}: mobile status needs PresenceStore.isMobileOnline`);
	}

	// After the successes, since recording an applied feature clears a recorded failure.
	recordApplied(applied);

	if (failed.length) recordFailure(`${failed.join(', ')} failed to start`);
}
