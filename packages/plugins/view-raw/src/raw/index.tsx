import { startFeatures } from '@unbound-plugins/shared/lifecycle/start-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchActionSheets, type SheetState } from '~/raw/action-sheets';
import { ActionSheets, ContextMenus } from '~/raw/modules';
import { patchContextMenus } from '~/raw/context-menus';

const PLUGIN_NAME = 'View Raw';

/**
 * @description Adds a View Raw row to the message, profile, channel and guild action sheets, and to a guild's context menu and a profile's overflow menu.
 * Patches `openLazy` on Discord's action sheet module and the long-press sheets it opens without it, plus `showContextMenu` on its context menu module.
 * Reads the Channel, Guild, User and UserProfile stores, and the clipboard and theme from `metro.common`.
 * The rows need only the action sheet module; the menu items start when the context menu module is there, and each feature starts on its own so one failure leaves the other running.
 * The Addon scope removes every patch when the plugin stops.
 */
export function startViewRaw(): () => Promise<void> {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets })) return async () => {};

	const state: SheetState = { open: null, profileUserId: null };
	const features = [() => patchActionSheets(state)];

	if (ensureModules(PLUGIN_NAME, { ContextMenus })) {
		features.push(() => patchContextMenus(state));
	}

	return startFeatures(PLUGIN_NAME, features);
}
