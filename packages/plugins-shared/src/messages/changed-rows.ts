type MessageKey = {
	id?: string;
	channel_id?: string;
};

// FluxActions types MESSAGE_UPDATE as a whole message, but Discord also applies the partial updates its gateway sends.
type RowUpdate = {
	type: string;
	message: MessageKey;
};

export type MessageRows = {
	isLoaded: (channelId: string, messageId: string) => boolean;
	dispatch: (action: RowUpdate) => Promise<void>;
};

export type ChangedRows = {
	add: (message: MessageKey | undefined) => void;
	rebuild: () => void;
};

export const CHANGED_ROWS_LIMIT = 1000;

/**
 * @description Remembers the messages whose chat rows a plugin changed, so it can have Discord build those rows again once it stops changing them.
 * @param plugin The plugin's display name, used in the log lines.
 * @param rows Whether one of Discord's message stores still holds a message, and Flux's `dispatch`.
 * @returns `add` records a message, keeping the most recent {@link CHANGED_ROWS_LIMIT}; `rebuild` updates each recorded message that is still loaded and forgets them all.
 */
export function trackChangedRows(plugin: string, rows: MessageRows): ChangedRows {
	const messages = new Map<string, string>();

	// UNKNOWN: a caught error or rejection reason.
	function report(id: string, error: unknown) {
		console.error(`[${plugin}] Failed to rebuild the row of message ${id}:`, error);
	}

	return {
		add(message) {
			if (!message?.id || !message.channel_id) return;

			messages.delete(message.id);
			messages.set(message.id, message.channel_id);

			const oldest = messages.keys().next().value;

			if (messages.size > CHANGED_ROWS_LIMIT && oldest !== undefined) {
				messages.delete(oldest);
			}
		},
		rebuild() {
			for (const [id, channelId] of messages) {
				try {
					if (!rows.isLoaded(channelId, id)) {
						continue;
					}

					// Discord keeps a built row and its parsed content until the message record changes. An id-only update replaces the record without changing its data.
					rows.dispatch({
						type: 'MESSAGE_UPDATE',
						message: { id, channel_id: channelId },
					}).catch((error) => report(id, error));
				} catch (error) {
					report(id, error);
				}
			}

			messages.clear();
		},
	};
}

export default trackChangedRows;
