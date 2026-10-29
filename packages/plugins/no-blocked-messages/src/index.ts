import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { whenAllLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchChatUpdatesQueue } from '~/patches/chat-updates-queue';
import { ChatClassFilters, ChatManager, ChatUpdatesQueue, RowManager } from '~/modules';
import { patchChatManager } from '~/patches/chat-manager';
import { patchRowManager } from '~/patches/row-manager';

let dispose = () => {};

function start() {
	if (!ensureModules('No Blocked Messages', { ChatManager, RowManager, ChatUpdatesQueue })) {
		return;
	}

	// Once every class has loaded, the patches' reads through the lazy handles load nothing.
	// The chat manager patch refreshes the open chat, so the managers it reads are captured first.
	dispose = whenAllLoaded(ChatClassFilters, () =>
		applyFeatures('No Blocked Messages', [
			patchRowManager,
			patchChatUpdatesQueue,
			patchChatManager,
		]),
	);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
