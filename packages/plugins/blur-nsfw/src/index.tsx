import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { PLUGIN_NAME } from '~/constants';
import SettingsPanel from '~/components/settings-panel';
import { patchRowManager } from '~/patches/row-manager';
import { ChannelStore } from '~/modules';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start() {
	if (!ensureModules(PLUGIN_NAME, { ChannelStore })) return;

	dispose = applyFeatures(PLUGIN_NAME, [patchRowManager]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export { featureSelfTest as selfTest, SettingsPanel };
