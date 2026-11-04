import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { NotificationSettings, UserGuildSettingsStore } from '~/apply/modules';
import { startGuildContextMenus, startGuildSheets } from '~/menu';
import { PLUGIN_NAME } from '~/constants';
import { startJoins } from '~/joins';
import SettingsPanel from '~/settings';

let disposers: (() => unknown)[] = [];

export function start() {
	if (!ensureModules(PLUGIN_NAME, { NotificationSettings, UserGuildSettingsStore })) return;

	// One call per feature, so a feature that throws is logged and recorded while the others still start.
	disposers = [startJoins, startGuildSheets, startGuildContextMenus].map((feature) =>
		applyFeatures(PLUGIN_NAME, [feature]),
	);
}

export function stop() {
	for (const dispose of disposers.splice(0)) dispose();
}

export { featureSelfTest as selfTest, SettingsPanel };
