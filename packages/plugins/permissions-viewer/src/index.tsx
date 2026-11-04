import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import {
	ActionSheets,
	ChannelStore,
	Constants,
	GuildMemberStore,
	GuildRoleStore,
	GuildStore,
	settings,
	UserStore,
} from '~/discord/modules';
import { patchActionSheets, type SheetState } from '~/action-sheets';
import { patchUserProfileRolesCard } from '~/roles-card';
import { patchContextMenus } from '~/context-menus';
import SettingsPanel from '~/settings';
import { SETTINGS } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start() {
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

	dispose = applyFeatures('Permissions Viewer', [
		() => patchActionSheets(state),
		() => patchContextMenus(state),
		() =>
			whileEnabled(
				settings,
				'rolesCardButton',
				SETTINGS.rolesCardButton,
				patchUserProfileRolesCard,
			),
	]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export { featureSelfTest as selfTest, SettingsPanel };
