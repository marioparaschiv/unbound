import type { Message, Renderers, RowGenerator } from '~/modules';
import { contentText, nativeUsernameColor } from '~/link-targets';
import { enableAnimatedEmojiSources } from '~/animated-media';

export type EmbeddedContent = {
	generator: RowGenerator;
	record: Message;
};

// A forward or a reply wraps the message that holds the content.
function messagePayload(message: Message): Message {
	for (const key of ['message', 'message_snapshot', 'messageSnapshot']) {
		const nested = message[key] as Message | undefined;

		if (typeof nested?.id === 'string' && nested.id !== message.id) return nested;
	}

	for (const key of ['message_snapshots', 'messageSnapshots']) {
		const snapshots = message[key];

		if (!Array.isArray(snapshots)) continue;

		for (const snapshot of snapshots as (Message | null)[]) {
			if (typeof snapshot?.id === 'string' && snapshot.id !== message.id) return snapshot;
		}
	}

	return message;
}

// MessageRecord reads both the API's snake_case fields and the client's camelCase ones.
function recordFields(message: Message, channelId: string): Message {
	const payload = messagePayload(message);

	return {
		...payload,
		id: payload.id,
		type: 0,
		channel_id: channelId,
		channelId,
		guild_id: payload.guild_id ?? payload.guildId ?? null,
		guildId: payload.guildId ?? payload.guild_id ?? null,
		content: contentText(payload.content),
		author: payload.author,
		attachments: payload.attachments ?? [],
		embeds: payload.embeds ?? [],
		mentions: payload.mentions ?? [],
		mention_roles: payload.mention_roles ?? [],
		mentionRoles: payload.mentionRoles ?? payload.mention_roles ?? [],
		timestamp:
			payload.timestamp instanceof Date
				? payload.timestamp
				: new Date(payload.timestamp ?? Date.now()),
		edited_timestamp: payload.edited_timestamp ?? null,
		editedTimestamp: payload.editedTimestamp ?? payload.edited_timestamp ?? null,
		pinned: Boolean(payload.pinned),
		mention_everyone: Boolean(payload.mention_everyone),
		mentionEveryone: Boolean(payload.mentionEveryone ?? payload.mention_everyone),
		tts: Boolean(payload.tts),
		flags: payload.flags ?? 0,
		components: payload.components ?? [],
		reactions: payload.reactions ?? [],
		sticker_items: payload.sticker_items ?? payload.stickerItems ?? [],
		stickers: payload.stickers ?? payload.sticker_items ?? [],
		message_reference: payload.message_reference ?? payload.messageReference ?? null,
		messageReference: payload.messageReference ?? payload.message_reference ?? null,
		message_snapshots: payload.message_snapshots ?? payload.messageSnapshots ?? [],
		messageSnapshots: payload.messageSnapshots ?? payload.message_snapshots ?? [],
		state: payload.state ?? 'SENT',
		nonce: payload.nonce ?? null,
	};
}

/**
 * @description Builds the record and row generator that render a linked message as a chat row, without reactions and with media playing.
 * @param renderers Discord's `MessageRecord` and `RowManager`.
 * @param message The linked message.
 * @param channelId The linked message's channel.
 * @returns The content for an embed, or `undefined` when Discord could not build its row.
 */
export function buildEmbeddedContent(
	{ MessageRecord, RowManager }: Renderers,
	message: Message,
	channelId: string,
): EmbeddedContent | undefined {
	try {
		const record: Message = new MessageRecord(recordFields(message, channelId));

		record.reactions = [];
		record.animateEmoji = true;

		const usernameColor = nativeUsernameColor(record.colorString);

		if (usernameColor !== undefined) record.usernameColor = usernameColor;

		const generator: RowGenerator = new RowManager();

		generator.setOptions({
			animateEmoji: true,
			animatingStickerMessageId: record.id,
			gifAutoPlay: true,
		});

		const generate = generator.generate.bind(generator);

		generator.generate = (input) => {
			const row = generate(input);
			const rendered = row?.message;

			if (rendered) {
				rendered.type = 0;
				rendered.renderContentOnly = false;
				rendered.animateEmoji = true;
				rendered.gifAutoPlay = true;
				enableAnimatedEmojiSources(rendered.content);

				if (usernameColor !== undefined) {
					rendered.colorString = usernameColor;
					rendered.usernameColor = usernameColor;
				}
			}

			return row;
		};

		const row = generator.generate({
			rowType: 1,
			changeType: 0,
			isFirst: false,
			canAddNewReactions: false,
			canShowImages: true,
			message: record,
		});

		if (!row) return;

		row.renderContentOnly = false;
		row.separatorBefore = false;

		return { generator, record };
	} catch {
		return;
	}
}
