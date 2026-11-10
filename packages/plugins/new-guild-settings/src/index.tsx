import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { NotificationSettings, UserGuildSettingsStore } from '~/apply/modules';
import { startGuildContextMenus, startGuildSheets } from '~/menu';
import { startJoins } from '~/joins';
import SettingsPanel from '~/settings';

export const { start, stop, selfTest } = runFeatures(() => {
	if (!ensureModules({ NotificationSettings, UserGuildSettingsStore })) return;

	return [startJoins, startGuildSheets, startGuildContextMenus];
});

export { SettingsPanel };
