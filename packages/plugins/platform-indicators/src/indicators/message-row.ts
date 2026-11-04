import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';

import { getPlatformStatuses } from '~/indicators/status-map';
import { MessageRowData, i18n } from '~/indicators/modules';
import { addPlatforms } from '~/indicators/header';

type Author = { id?: string; bot?: boolean; system?: boolean };
type Message = { author?: Author; type?: number };

function isChatMessage(message: Message) {
	return message.type === 0 || message.type === 19;
}

/**
 * @description Shows each message author's platforms after the message timestamp.
 */
export function patchMessageRow(): void {
	patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		if (!settings.messages) return;

		const message: Message | undefined = args[0]?.message;
		const author = message?.author;
		const row = result?.message;

		if (!message || !isChatMessage(message) || !author?.id || author.bot || author.system)
			return;

		if (!row) return;

		addPlatforms(row, getPlatformStatuses(author.id), i18n.intl?.currentLocale ?? 'en-US');
	});
}
