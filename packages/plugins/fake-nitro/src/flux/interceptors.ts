import { flux } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { realExpressions, type ReceivedMessage } from '~/lib/receive';

type MessageAction = { message?: ReceivedMessage };

type MessagesAction = { messages?: ReceivedMessage[] };

function turnBack(message: ReceivedMessage): ReceivedMessage {
	return (
		realExpressions(message, {
			emojis: settings.receiveEmojis,
			stickers: settings.receiveStickers,
		}) ?? message
	);
}

/**
 * @description Shows fake emojis and stickers sent as links, yours included, as real ones. Intercepts `MESSAGE_CREATE`,
 * `MESSAGE_UPDATE` and `LOAD_MESSAGES_SUCCESS` to rewrite each message before Discord stores it.
 */
export function interceptReceivedMessages(): void {
	if (!settings.receiveEmojis && !settings.receiveStickers) return;

	for (const type of ['MESSAGE_CREATE', 'MESSAGE_UPDATE'] as const) {
		flux.interceptAction(type, (action) => {
			const payload = action as MessageAction;

			if (payload.message) payload.message = turnBack(payload.message);

			return false;
		});
	}

	flux.interceptAction('LOAD_MESSAGES_SUCCESS', (action) => {
		const payload = action as MessagesAction;

		if (Array.isArray(payload.messages)) payload.messages = payload.messages.map(turnBack);

		return false;
	});
}
