import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import SettingsPanel from '~/components/settings-panel';
import { patchCommands } from '~/patches/commands';
import { Commands, Messages } from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules('Custom Commands', { Commands, Messages })) return;

	dispose = applyFeatures('Custom Commands', [patchCommands]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default {
	start,
	stop,
	getSettingsPanel: () => <SettingsPanel />,
};
