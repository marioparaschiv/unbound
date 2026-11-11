import { skipFeature, type Feature } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { MessageRowData } from '@unbound-plugins/shared/metro/message-rows';

import { patchUserProfilePrimaryInfo } from '~/indicators/profile';
import { patchMobileStatus } from '~/indicators/mobile-status';
import { patchMessageRow } from '~/indicators/message-row';
import { patchUserRow } from '~/indicators/member-list';
import { PresenceStore, SessionsStore, Theme, ThemeStore, UserStore } from '~/indicators/modules';

/**
 * @description Shows the platforms a user is online on in the member list, on profiles and in message headers, and
 * lets Discord draw the mobile status shape for idle and busy users. Patches the render of `UserRow` and
 * `UserProfilePrimaryInfo`, `generateMessageRowData` on Discord's message row module, and `isMobileOnline` on
 * `PresenceStore`. Reads `SessionsStore` and `UserStore` for the signed-in user, and `Theme` and `ThemeStore` for
 * the icon colors. Each patch reads its setting when it runs, so a switch applies at once. A feature that throws on start
 * is logged and recorded, and the others still start. The Addon scope removes the patches.
 * @returns The features whose modules were found, or nothing when a module every feature needs is missing.
 */
export function indicatorFeatures(): Feature[] | undefined {
	if (!ensureModules({ PresenceStore, SessionsStore, UserStore })) return;

	const features: Feature[] = [];

	if (ensureModules({ Theme, ThemeStore }, 'member list')) {
		features.push(patchUserRow);
	}

	if (ensureModules({ Theme, ThemeStore }, 'profiles')) {
		features.push(patchUserProfilePrimaryInfo);
	}

	if (ensureModules({ MessageRowData }, 'messages')) {
		features.push(patchMessageRow);
	}

	if (typeof PresenceStore.isMobileOnline === 'function') {
		features.push(patchMobileStatus);
	} else {
		skipFeature('mobile status needs PresenceStore.isMobileOnline');
	}

	return features;
}
