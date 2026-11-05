import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import { whenAllLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { ChatClassFilters, ChatManager, ChatUpdatesQueue, RowManager } from '~/blocked/modules';
import { chat, refreshChat } from '~/blocked/chat';

let showBlocked = () => {};

/**
 * @description Hides the rows that stand in for blocked messages, and refreshes the open chat so it applies at once.
 * Patches `ChatManager` (`setup`, `createRow`), `RowManager` (`generate`) and `ChatUpdatesQueue` (`add`) once all three classes have loaded.
 * The Addon scope removes the patches, but not the hidden rows, so `stopBlocked` stops hiding and refreshes the chat.
 */
export function startBlocked(): void {
	if (!ensureModules('No Blocked Messages', { ChatManager, RowManager, ChatUpdatesQueue }))
		return;

	// Once every class has loaded, the reads through the lazy handles load nothing.
	// The chat manager patch refreshes the open chat, so the managers it reads are captured first.
	showBlocked = whenAllLoaded(ChatClassFilters, () => {
		patchRowManager();
		patchChatUpdatesQueue();

		return patchChatManager();
	});
}

/**
 * @description Shows blocked messages in the open chat again.
 */
export function stopBlocked(): void {
	showBlocked();
	showBlocked = () => {};
}

function patchRowManager() {
	if (typeof RowManager.prototype?.generate !== 'function') {
		console.error('[No Blocked Messages] Skipped, RowManager.generate not found.');

		return;
	}

	patcher.before(RowManager.prototype, 'generate', ({ this: self }) => {
		chat.rowManager = self;
	});

	recordApplied(1);
}

function patchChatUpdatesQueue() {
	if (typeof ChatUpdatesQueue.prototype?.add !== 'function') {
		console.error('[No Blocked Messages] Skipped, ChatUpdatesQueue.add not found.');

		return;
	}

	patcher.before(ChatUpdatesQueue.prototype, 'add', ({ this: self }) => {
		chat.updatesQueue = self;
	});

	recordApplied(1);
}

function patchChatManager() {
	const { prototype } = ChatManager;

	if (typeof prototype?.setup !== 'function' || typeof prototype.createRow !== 'function') {
		console.error('[No Blocked Messages] Skipped, ChatManager.createRow not found.');

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
	recordApplied(1);

	return () => {
		unpatchCreateRow();
		refreshChat();
	};
}
