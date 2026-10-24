import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchFloatingChatInputContainer } from '~/patches/floating-chat-input-container';
import SettingsPanel from '~/components/settings-panel';
import { ChatInputs, UserStore } from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules('Character Counter', { ChatInputs, UserStore })) return;

	dispose = applyFeatures('Character Counter', [patchFloatingChatInputContainer]);
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
