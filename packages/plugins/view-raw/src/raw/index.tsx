import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchActionSheets, type SheetState } from '~/raw/action-sheets';
import { ActionSheets, ContextMenus } from '~/raw/modules';
import { patchContextMenus } from '~/raw/context-menus';

/**
 * @description Adds a View Raw row to the message, profile, channel and guild action sheets, and to a guild's context menu and a profile's overflow menu.
 * Patches `openLazy` on Discord's action sheet module and the long-press sheets it opens without it, plus `showContextMenu` on its context menu module.
 * Reads the Channel, Guild, User and UserProfile stores, and the clipboard and theme from `metro.common`.
 * The Addon scope removes every patch when the plugin stops.
 */
export function startViewRaw(): void {
	if (!ensureModules('View Raw', { ActionSheets, ContextMenus })) return;

	const state: SheetState = { open: null, profileUserId: null };

	patchActionSheets(state);
	patchContextMenus(state);
	recordApplied(2);
}
