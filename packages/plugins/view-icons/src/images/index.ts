import type { Feature } from '@unbound-plugins/shared/lifecycle/features';
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
 * @returns The features, each started on its own so one failing leaves the other applied; `undefined` when the plugin skipped starting.
 */
export function startImages(): Feature[] | undefined {
	const ready = ensureModules({
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

	return [() => patchActionSheets(opened), () => patchContextMenus(opened)];
}
