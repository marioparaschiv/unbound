import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import {
	ActionSheets,
	ChannelStore,
	Constants,
	GuildMemberStore,
	GuildRoleStore,
	GuildStore,
	UserStore,
} from '~/viewer/modules';
import { patchActionSheets, type SheetState } from '~/viewer/action-sheets';
import { patchUserProfileRolesCard } from '~/viewer/roles-card';
import { patchContextMenus } from '~/viewer/context-menus';

/**
 * @description Adds View Permissions rows to profile, channel and server sheets and menus, and a button under the roles card of a server profile.
 * Depends on Discord's action sheets (`metro.api.ActionSheets`), `Constants.Permissions`, and the channel, guild, guild member, guild role and user stores. The Addon scope removes every patch when the plugin stops.
 */
export function startViewer(): void {
	const ready = ensureModules('Permissions Viewer', {
		ActionSheets,
		ChannelStore,
		Constants,
		GuildMemberStore,
		GuildRoleStore,
		GuildStore,
		UserStore,
	});

	if (!ready) return;

	const state: SheetState = { open: null, profile: null };

	patchActionSheets(state);
	patchContextMenus(state);
	patchUserProfileRolesCard();
	recordApplied(3);
}
