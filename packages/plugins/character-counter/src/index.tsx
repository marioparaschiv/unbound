import { featureSelfTest, recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchFloatingChatInputContainer } from '~/patches/floating-chat-input-container';
import SettingsPanel from '~/components/settings-panel';
import { ChatInputs, UserStore } from '~/modules';

function start() {
	if (!ensureModules('Character Counter', { ChatInputs, UserStore })) return;

	patchFloatingChatInputContainer();
	recordApplied(1);
}

export default {
	start,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
