import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchMessageActions } from '~/patches/message-actions';
import SettingsPanel from '~/components/settings-panel';
import { normalizeStoredRules } from '~/stored-rules';
import { Messages } from '~/modules';

let dispose = () => {};

function start() {
	normalizeStoredRules();

	if (!ensureModules('Text Replace', { Messages })) return;

	dispose = applyFeatures('Text Replace', [patchMessageActions]);
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
