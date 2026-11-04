import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import SettingsPanel from '~/components/settings-panel';
import { patchChannelRecord } from '~/patches/channel-record';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start() {
	dispose = applyFeatures(PLUGIN_NAME, [patchChannelRecord]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export { featureSelfTest as selfTest, SettingsPanel };
