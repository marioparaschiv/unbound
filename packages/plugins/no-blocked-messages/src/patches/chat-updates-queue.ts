import { ChatUpdatesQueue, Patcher } from '~/modules';
import { chat } from '~/chat';

/**
 * @description Remembers the open chat's update queue so the chat can be refreshed.
 * @returns A function that removes the patch.
 */
export function patchChatUpdatesQueue(): () => void {
	if (typeof ChatUpdatesQueue.prototype?.add !== 'function') {
		console.error('[No Blocked Messages] Skipped, ChatUpdatesQueue.add not found.');

		return () => {};
	}

	return Patcher.before(ChatUpdatesQueue.prototype, 'add', ({ this: self }) => {
		chat.updatesQueue = self;
	});
}
