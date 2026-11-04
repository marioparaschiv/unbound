import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { UserStore } from '~/modules';
import { syncPresence } from '~/presence';
import { PLUGIN_NAME } from '~/constants';
import SettingsPanel from '~/components/settings-panel';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start() {
	if (!ensureModules(PLUGIN_NAME, { UserStore })) return;

	dispose = applyFeatures(PLUGIN_NAME, [syncPresence]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export const selfTest = featureSelfTest;
export { SettingsPanel };
