import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import type { PluginContext } from '@unbound-app/api/native';

import { startFeatures } from '~/shared/start-features';
import { startMemberList } from '~/member-list';
import { startReactions } from '~/reactions';
import { startTyping } from '~/typing';
import { startChat } from '~/chat';
import { startVoice } from '~/voice';
import { startPolls } from '~/polls';

let stopFeatures = async () => {};

export function start(context: PluginContext) {
	stopFeatures = startFeatures([
		() => startChat(context),
		startTyping,
		startMemberList,
		startReactions,
		startPolls,
		startVoice,
	]);
}

export function stop() {
	return stopFeatures();
}

export { featureSelfTest as selfTest };
