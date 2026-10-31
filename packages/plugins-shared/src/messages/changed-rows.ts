import type { FluxMessage } from '@unbound-app/api/flux';
import { flux } from '@unbound-app/api';

type MessageIds = {
	id?: string;
	channel_id?: string;
};

type GetMessage = (channelId: string, messageId: string) => FluxMessage | null | undefined;

export type ChangedRows = {
	add: (message: MessageIds | undefined) => void;
	rebuild: () => void;
};

/**
 * @description Remembers the messages whose chat rows a plugin changed, so it can have Discord build those rows again once it stops changing them.
 * @param getMessage Reads a message's current record from Discord's `MessageStore`.
 * @returns `add` records a message whose row was changed, `rebuild` updates each recorded message that is still loaded and forgets them all.
 */
export function trackChangedRows(getMessage: GetMessage): ChangedRows {
	const channels = new Map<string, string>();

	return {
		add(message) {
			if (message?.id && message.channel_id) channels.set(message.id, message.channel_id);
		},
		rebuild() {
			// Discord keeps a built row, and its parsed content, until the message updates.
			for (const [id, channelId] of channels) {
				const message = getMessage(channelId, id);

				if (message) {
					void flux.dispatch({
						type: 'MESSAGE_UPDATE',
						message: { ...message },
						log_edit: false,
					});
				}
			}

			channels.clear();
		},
	};
}

export default trackChangedRows;
