import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { NotificationSettings, UserGuildSettingsStore } from '~/apply/modules';
import { addApplyMenuItems } from '~/menu';
import { PLUGIN_NAME } from '~/constants';
import { applyOnJoin } from '~/joins';
import SettingsPanel from '~/settings';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start() {
	if (!ensureModules(PLUGIN_NAME, { NotificationSettings, UserGuildSettingsStore })) return;

	dispose = applyFeatures(PLUGIN_NAME, [applyOnJoin, addApplyMenuItems]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export { featureSelfTest as selfTest, SettingsPanel };
