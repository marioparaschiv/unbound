import { whenAllLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { skipFeature } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { ChatClassFilters, ChatManager, ChatUpdatesQueue, RowManager } from '~/blocked/modules';
import { chat, refreshChat } from '~/blocked/chat';

/**
 * @description Hides the rows that stand in for blocked messages, and refreshes the open chat so it applies at once.
 * Patches `ChatManager` (`setup`, `createRow`), `RowManager` (`generate`) and `ChatUpdatesQueue` (`add`) once all three classes have loaded.
 * The Addon scope removes the patches, but not the hidden rows.
 * @returns A function that shows blocked messages in the open chat again.
 */
export function startBlocked(): (() => void) | undefined {
	if (!ensureModules({ ChatManager, RowManager, ChatUpdatesQueue })) return;

	// Once every class has loaded, the reads through the lazy handles load nothing.
	// The chat manager patch refreshes the open chat, so the managers it reads are captured first.
	return whenAllLoaded(ChatClassFilters, () => {
		patchRowManager();
		patchChatUpdatesQueue();

		return patchChatManager();
	});
}

function patchRowManager() {
	if (typeof RowManager.prototype?.generate !== 'function') {
		skipFeature('RowManager.generate not found');

		return;
	}

	patcher.before(RowManager.prototype, 'generate', ({ this: self }) => {
		chat.rowManager = self;
	});
}

function patchChatUpdatesQueue() {
	if (typeof ChatUpdatesQueue.prototype?.add !== 'function') {
		skipFeature('ChatUpdatesQueue.add not found');

		return;
	}

	patcher.before(ChatUpdatesQueue.prototype, 'add', ({ this: self }) => {
		chat.updatesQueue = self;
	});
}

function patchChatManager() {
	const { prototype } = ChatManager;

	if (typeof prototype?.setup !== 'function' || typeof prototype.createRow !== 'function') {
		skipFeature('ChatManager.createRow not found');

		return;
	}

	patcher.before(prototype, 'setup', ({ args, this: self }) => {
		chat.chatManager = self;
		chat.messages = args[0];
	});

	const unpatchCreateRow = patcher.instead(prototype, 'createRow', ({ args, original }) => {
		// Row type 2 stands in for a blocked message.
		if (args[0]?.type === 2) return;

		return original(...args);
	});

	refreshChat();

	return () => {
		unpatchCreateRow();
		refreshChat();
	};
}
