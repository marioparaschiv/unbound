export type RawEmbed = {
	title?: string;
	description?: string;
	footer?: { text: string };
};

export type RawMessage = {
	id: string;
	channel_id: string;
	content?: string;
	mentions?: { id: string }[];
	embeds?: RawEmbed[];
	message_reference?: { channel_id: string; message_id: string };
};

export type ModelEmbed = {
	rawTitle?: string;
	rawDescription?: string;
	footer?: { text: string };
};

export type ModelMessage = {
	id: string;
	channel_id: string;
	content: string;
	mentions: string[];
	mentioned: boolean;
	embeds: ModelEmbed[];
	messageReference?: { channel_id: string; message_id: string };
};

type ModelAction = {
	type: string;
	message?: Partial<RawMessage>;
};

export type MessageStoreModel = {
	add: (raw: RawMessage) => ModelMessage;
	getMessage: (channelId: string, messageId: string) => ModelMessage | undefined;
	dispatch: (action: ModelAction) => Promise<void>;
};

export type ChatModel<Row> = {
	rows: () => Row[];
};

type BuiltRow<Row> = {
	record: ModelMessage;
	row: Row;
};

function sanitizeEmbed(embed: RawEmbed): ModelEmbed {
	return { rawTitle: embed.title, rawDescription: embed.description, footer: embed.footer };
}

/**
 * @description Models how Discord's `MessageStore` applies `MESSAGE_UPDATE`: the payload is read as a raw API message and each field it carries is rebuilt into a new record.
 * @param currentUserId The user whose mention sets `mentioned`.
 * @returns A store with `add` for raw messages, Discord's `getMessage`, and a `dispatch` that handles `MESSAGE_UPDATE`.
 */
export function createMessageStoreModel(currentUserId: string): MessageStoreModel {
	const records = new Map<string, ModelMessage>();

	function build(record: ModelMessage, raw: Partial<RawMessage>): ModelMessage {
		const next = { ...record };

		if (raw.content !== undefined) {
			next.content = raw.content;
		}

		if (raw.mentions !== undefined) {
			next.mentions = raw.mentions.map((user) => user.id);
		}

		if (raw.embeds !== undefined) {
			next.embeds = raw.embeds.map(sanitizeEmbed);
		}

		next.mentioned = next.mentions.includes(currentUserId);

		return next;
	}

	return {
		add(raw) {
			const record = build(
				{
					id: raw.id,
					channel_id: raw.channel_id,
					content: '',
					mentions: [],
					mentioned: false,
					embeds: [],
					messageReference: raw.message_reference,
				},
				raw,
			);

			records.set(raw.id, record);

			return record;
		},
		getMessage(channelId, messageId) {
			const record = records.get(messageId);

			return record?.channel_id === channelId ? record : undefined;
		},
		dispatch(action) {
			const id = action.message?.id;
			const existing = id === undefined ? undefined : records.get(id);

			if (action.type === 'MESSAGE_UPDATE' && action.message && existing) {
				records.set(existing.id, build(existing, action.message));
			}

			return Promise.resolve();
		},
	};
}

/**
 * @description Models Discord's chat list, which builds a row again only when its message's record changed.
 * @template Row The row `generate` returns.
 * @param store The message store the chat reads.
 * @param messageIds The messages shown, as `[channelId, messageId]` pairs.
 * @param generate Builds one message's row.
 * @returns `rows`, which returns the current rows, rebuilding those whose record changed.
 */
export function createChatModel<Row>(
	store: MessageStoreModel,
	messageIds: [string, string][],
	generate: (message: ModelMessage) => Row,
): ChatModel<Row> {
	const built = new Map<string, BuiltRow<Row>>();

	return {
		rows() {
			return messageIds.flatMap(([channelId, messageId]) => {
				const record = store.getMessage(channelId, messageId);

				if (!record) {
					return [];
				}

				let entry = built.get(messageId);

				if (entry?.record !== record) {
					entry = { record, row: generate(record) };
					built.set(messageId, entry);
				}

				return [entry.row];
			});
		},
	};
}
