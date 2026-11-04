import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { NotificationSettings, UserGuildSettingsStore } from '~/apply/modules';
import { startMenu, stopMenu } from '~/menu';
import { PLUGIN_NAME } from '~/constants';
import { startJoins } from '~/joins';
import SettingsPanel from '~/settings';

export function start() {
	if (!ensureModules(PLUGIN_NAME, { NotificationSettings, UserGuildSettingsStore })) return;

	startJoins();
	startMenu();
}

export function stop() {
	stopMenu();
}

export { featureSelfTest as selfTest, SettingsPanel };
