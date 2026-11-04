import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import type { PluginContext } from '@unbound-app/api/native';

import { startMemberList } from '~/member-list';
import { startReactions } from '~/reactions';
import { startChat, stopChat } from '~/chat';
import { startTyping } from '~/typing';
import { startVoice } from '~/voice';
import { startPolls } from '~/polls';

export function start(context: PluginContext) {
	startChat(context);
	startTyping();
	startMemberList();
	startReactions();
	startPolls();
	startVoice();
}

export function stop() {
	return stopChat();
}

export { featureSelfTest as selfTest };
