import { startFeatures } from '@unbound-plugins/shared/lifecycle/start-features';
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

	startFeatures('View Icons', [() => patchActionSheets(opened), () => patchContextMenus(opened)]);
}
