import { onMessageRow, type RowMessage } from '@unbound-plugins/shared/metro/message-rows';
import { settings } from '@unbound-app/settings';

import { getPlatformStatuses } from '~/indicators/status-map';
import { addPlatforms } from '~/indicators/header';
import { i18n } from '~/indicators/modules';

function isChatMessage(message: RowMessage) {
	return message.type === 0 || message.type === 19;
}

/**
 * @description Shows each message author's platforms after the message timestamp.
 */
export function patchMessageRow(): void {
	onMessageRow({
		after({ message, row }) {
			if (!settings.messages) return;

			const author = message?.author;

			if (!message || !isChatMessage(message) || !author?.id || author.bot || author.system)
				return;

			if (!row) return;

			addPlatforms(row, getPlatformStatuses(author.id), i18n.intl?.currentLocale ?? 'en-US');
		},
	});
}
