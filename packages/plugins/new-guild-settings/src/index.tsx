import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { NotificationSettings, UserGuildSettingsStore } from '~/apply/modules';
import { startGuildContextMenus, startGuildSheets } from '~/menu';
import { migrateSettings } from '~/settings-migration';
import { startJoins } from '~/joins';

export const { start, stop, selfTest } = runFeatures(() => {
	migrateSettings();

	if (!ensureModules({ NotificationSettings, UserGuildSettingsStore })) return;

	return [startJoins, startGuildSheets, startGuildContextMenus];
});
