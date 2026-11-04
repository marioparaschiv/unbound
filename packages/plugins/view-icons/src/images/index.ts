import { recordApplied, recordFailure } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import {
	ChannelStore,
	GuildMemberStore,
	GuildStore,
	IconUtils,
	Media,
	UserProfileStore,
	UserStore,
} from '~/images/modules';
import type { SheetRef } from '~/images/opened-sheet';
import { patchActionSheets } from '~/images/action-sheets';
import { patchContextMenus } from '~/images/context-menus';

/**
 * @description Adds View rows for avatars, banners and icons to profile and guild action sheets and to long-press menus.
 * Patches `openLazy` on Discord's action sheet module and `showContextMenu` on its context menu module, and reads
 * images from `IconUtils` and the user, profile, member, guild and channel stores. The Addon scope removes the patches when the plugin stops.
 * One patch failing is logged and recorded, and the other still applies.
 */
export function startImages(): void {
	const ready = ensureModules('View Icons', {
		IconUtils,
		Media,
		ChannelStore,
		GuildMemberStore,
		GuildStore,
		UserProfileStore,
		UserStore,
	});

	if (!ready) return;

	const opened: SheetRef = { current: null };

	const features = { 'action sheets': patchActionSheets, 'context menus': patchContextMenus };
	const failed: string[] = [];

	for (const [name, patch] of Object.entries(features)) {
		try {
			patch(opened);
			recordApplied(1);
		} catch (error) {
			console.error(`[View Icons] Failed to patch the ${name}:`, error);
			failed.push(name);
		}
	}

	if (failed.length) recordFailure(`could not patch the ${failed.join(' and ')}`);
}
