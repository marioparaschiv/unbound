import { startFeatures } from '@unbound-plugins/shared/lifecycle/start-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { NotificationSettings, UserGuildSettingsStore } from '~/apply/modules';
import { startGuildContextMenus, startGuildSheets } from '~/menu';
import { PLUGIN_NAME } from '~/constants';
import { startJoins } from '~/joins';
import SettingsPanel from '~/settings';

let stopFeatures: (() => Promise<void>) | undefined;

export function start() {
	if (!ensureModules(PLUGIN_NAME, { NotificationSettings, UserGuildSettingsStore })) return;

	stopFeatures = startFeatures(PLUGIN_NAME, [
		startJoins,
		startGuildSheets,
		startGuildContextMenus,
	]);
}

export async function stop() {
	await stopFeatures?.();
	stopFeatures = undefined;
}

export { featureSelfTest as selfTest, SettingsPanel };
