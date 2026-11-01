import { patcher } from '@unbound-app/api';

import { CHANGE_TYPE_NONE, CHANGE_TYPE_UPDATE, PLUGIN_NAME } from '~/constants';
import { ChatManager } from '~/discord/modules';
import type { MessageLog } from '~/log';

type ChangeInput = {
	message?: { id?: string };
};

/**
 * @description Makes the chat send a row to the native list when only its log changed, which Discord would otherwise see as unchanged.
 * @param log The message log.
 * @returns A function that removes the patch.
 */
export function patchChatManager(log: MessageLog): () => void {
	if (typeof ChatManager.prototype?.determineChangeType !== 'function') {
		console.error(`[${PLUGIN_NAME}] Skipped, ChatManager.determineChangeType not found.`);

		return () => {};
	}

	return patcher.after(
		ChatManager.prototype,
		'determineChangeType',
		({ args: [input], result }) => {
			const messageId = (input as ChangeInput | undefined)?.message?.id;

			if (result !== CHANGE_TYPE_NONE || !messageId || !log.takeRender(messageId)) return;

			return CHANGE_TYPE_UPDATE;
		},
	);
}

export default patchChatManager;
