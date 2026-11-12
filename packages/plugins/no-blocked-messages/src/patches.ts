import { metro, patcher } from '@unbound-app/api';

import {
	chat,
	refreshChat,
	type ChatManagerInstance,
	type ChatUpdatesQueueInstance,
	type RowManagerInstance,
} from '~/lib/chat';

// Discord's chat classes; the patches check each method at runtime, since a Discord update may drop one.
type ChatClass<Instance> = { prototype?: Instance };

/**
 * @description Hides the rows that stand in for blocked messages, and refreshes the open chat so it applies at once.
 * Patches `ChatManager` (`setup`, `createRow`), `RowManager` (`generate`) and `ChatUpdatesQueue` (`add`) once all three
 * classes have loaded. The Addon scope removes the patches, but not the hidden rows: `stop` calls `refreshChat`.
 */
export function patchChatRows(): void {
	const ChatManager = metro.findByName('ChatManager');
	const RowManager = metro.findByName('RowManager');
	const ChatUpdatesQueue = metro.findByName('ChatUpdatesQueue');

	if (!ChatManager || !RowManager || !ChatUpdatesQueue) {
		logger.warn(
			'Blocked messages skipped: Discord moved ChatManager, RowManager or ChatUpdatesQueue.',
		);

		return;
	}

	// The chat manager patch refreshes the open chat, so the managers it reads are captured first.
	metro.onModuleLoaded(metro.filters.byName('ChatManager'), (chatManager) => {
		metro.onModuleLoaded(metro.filters.byName('RowManager'), (rowManager) => {
			metro.onModuleLoaded(metro.filters.byName('ChatUpdatesQueue'), (updatesQueue) => {
				patchRowManager(rowManager);
				patchChatUpdatesQueue(updatesQueue);
				patchChatManager(chatManager);
			});
		});
	});
}

function patchRowManager(RowManager: ChatClass<RowManagerInstance>) {
	if (typeof RowManager.prototype?.generate !== 'function') {
		logger.warn('Blocked messages skipped: Discord moved RowManager.generate.');

		return;
	}

	patcher.before(RowManager.prototype, 'generate', ({ this: self }) => {
		chat.rowManager = self;
	});
}

function patchChatUpdatesQueue(ChatUpdatesQueue: ChatClass<ChatUpdatesQueueInstance>) {
	if (typeof ChatUpdatesQueue.prototype?.add !== 'function') {
		logger.warn('Blocked messages skipped: Discord moved ChatUpdatesQueue.add.');

		return;
	}

	patcher.before(ChatUpdatesQueue.prototype, 'add', ({ this: self }) => {
		chat.updatesQueue = self;
	});
}

function patchChatManager(ChatManager: ChatClass<ChatManagerInstance>) {
	const { prototype } = ChatManager;

	if (typeof prototype?.setup !== 'function' || typeof prototype.createRow !== 'function') {
		logger.warn('Blocked messages skipped: Discord moved ChatManager.createRow.');

		return;
	}

	patcher.before(prototype, 'setup', ({ args, this: self }) => {
		chat.chatManager = self;
		chat.messages = args[0];
	});

	patcher.instead(prototype, 'createRow', ({ args, original }) => {
		// Row type 2 stands in for a blocked message.
		if (args[0]?.type === 2) return;

		return original(...args);
	});

	refreshChat();
}
