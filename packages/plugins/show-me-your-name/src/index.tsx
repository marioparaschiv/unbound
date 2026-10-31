import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { patchAuthorNames, patchReplyNames } from '~/patches/message-row-data';
import { MessageRowData, UserStore, settings } from '~/modules';
import SettingsPanel from '~/components/settings-panel';

let dispose = () => {};

function start() {
	if (!ensureModules('Show Me Your Name', { MessageRowData, UserStore })) return;

	dispose = applyFeatures('Show Me Your Name', [
		patchAuthorNames,
		() => whileEnabled(settings, 'inReplies', false, patchReplyNames),
	]);
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
