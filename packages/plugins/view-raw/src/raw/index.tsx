import { recordApplied, recordFailure } from '@unbound-plugins/shared/lifecycle/health';
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
export function startViewRaw(): void {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets })) return;

	const state: SheetState = { open: null, profileUserId: null };
	const features = [() => patchActionSheets(state)];

	if (ensureModules(PLUGIN_NAME, { ContextMenus })) {
		features.push(() => patchContextMenus(state));
	}

	const failures: string[] = [];
	let applied = 0;

	for (const start of features) {
		try {
			start();
			applied++;
		} catch (error) {
			console.error(`[${PLUGIN_NAME}] Failed to start a feature:`, error);
			failures.push(error instanceof Error ? error.message : String(error));
		}
	}

	recordApplied(applied);

	for (const failure of failures) recordFailure(failure);
}
