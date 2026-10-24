import { ChatManager, Patcher } from '~/modules';
import { chat, refreshChat } from '~/chat';

/**
 * @description Skips the rows that stand in for blocked messages, remembers the open chat, and refreshes it on apply and removal.
 * @returns A function that removes the patches and shows blocked messages in the open chat again.
 */
export function patchChatManager(): () => void {
	const { prototype } = ChatManager;

	if (typeof prototype?.setup !== 'function' || typeof prototype.createRow !== 'function') {
		console.error('[No Blocked Messages] Skipped, ChatManager.createRow not found.');

		return () => {};
	}

	const unpatchSetup = Patcher.before(prototype, 'setup', ({ args, this: self }) => {
		chat.chatManager = self;
		chat.messages = args[0];
	});

	const unpatchCreateRow = Patcher.instead(prototype, 'createRow', ({ args, original }) => {
		// Row type 2 stands in for a blocked message.
		if (args[0]?.type === 2) return;

		return original(...args);
	});

	refreshChat();

	return () => {
		unpatchCreateRow();
		refreshChat();
		unpatchSetup();
	};
}
