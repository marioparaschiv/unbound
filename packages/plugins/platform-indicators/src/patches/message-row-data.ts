import { patcher } from '@unbound-app/api';

import { getPlatformStatuses } from '~/status-map';
import { MessageRowData } from '~/modules';
import { addPlatforms } from '~/header';

type Author = { id?: string; bot?: boolean; system?: boolean };
type Message = { author?: Author; type?: number };

function isChatMessage(message: Message) {
	return message.type === 0 || message.type === 19;
}

/**
 * @description Shows each message author's platforms after the message timestamp.
 * @returns A function that removes the patch.
 */
export function patchMessageRowData(): () => void {
	return patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		const message: Message | undefined = args[0]?.message;
		const author = message?.author;
		const row = result?.message;

		if (!message || !isChatMessage(message) || !author?.id || author.bot || author.system)
			return;

		if (!row) return;

		addPlatforms(row, getPlatformStatuses(author.id));
	});
}

export default patchMessageRowData;
