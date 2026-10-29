import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchChatUpdatesQueue } from '~/patches/chat-updates-queue';
import { ChatManager, ChatUpdatesQueue, RowManager } from '~/modules';
import { patchChatManager } from '~/patches/chat-manager';
import { patchRowManager } from '~/patches/row-manager';

let dispose = () => {};

function start() {
	if (!ensureModules('No Blocked Messages', { ChatManager, RowManager, ChatUpdatesQueue })) {
		return;
	}

	// The chat manager patch refreshes the open chat, so the managers it reads are captured first.
	dispose = applyFeatures('No Blocked Messages', [
		patchRowManager,
		patchChatUpdatesQueue,
		patchChatManager,
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop, selfTest: featureSelfTest };
