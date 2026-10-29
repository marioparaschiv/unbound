import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchActionSheets } from '~/patches/action-sheets';
import SettingsPanel from '~/components/settings-panel';
import { ActionSheets } from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules('Translate', { ActionSheets })) return;

	dispose = applyFeatures('Translate', [patchActionSheets]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
