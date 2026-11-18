import { flux } from '@unbound-app/api';

import { withImages, type EmbedImage, type MessageEmbed } from './image-embed';

type ReceivedMessage = {
	id?: string;
	channel_id?: string;
	content?: string;
	embeds?: MessageEmbed[];
};

type MessageAction = { message?: ReceivedMessage };

type MessagesAction = { messages?: ReceivedMessage[] };

type MessageLookup = {
	getMessage?: (channelId: string, messageId: string) => { content?: string } | undefined;
};

type FindImages = (content: string) => EmbedImage[];

function storedContent({ id, channel_id }: ReceivedMessage): string | undefined {
	if (!id || !channel_id) return undefined;

	const store = flux.getStore('Message') as unknown as MessageLookup | undefined;

	return store?.getMessage?.(channel_id, id)?.content;
}

function addImages(
	message: ReceivedMessage,
	find: FindImages,
	content = message.content,
): ReceivedMessage {
	const images = content ? find(content) : [];

	if (!images.length) return message;

	return { ...message, embeds: withImages(message.embeds ?? [], images) };
}

function addImagesToUpdate(message: ReceivedMessage, find: FindImages): ReceivedMessage {
	if (message.content === undefined && !message.embeds) return message;

	return addImages(message, find, message.content ?? storedContent(message));
}

/**
 * @description Shows images under messages whose content `find` matches, for everyone's messages. Intercepts
 * `MESSAGE_CREATE`, `MESSAGE_UPDATE` and `LOAD_MESSAGES_SUCCESS` to add the embeds before Discord stores the message.
 * @param find Reads the images a message's content should show.
 */
export function addImageEmbeds(find: FindImages): void {
	flux.interceptAction('MESSAGE_CREATE', (action) => {
		const payload = action as MessageAction;

		if (payload.message) payload.message = addImages(payload.message, find);

		return false;
	});

	flux.interceptAction('MESSAGE_UPDATE', (action) => {
		const payload = action as MessageAction;

		if (payload.message) payload.message = addImagesToUpdate(payload.message, find);

		return false;
	});

	flux.interceptAction('LOAD_MESSAGES_SUCCESS', (action) => {
		const payload = action as MessagesAction;

		if (Array.isArray(payload.messages)) {
			payload.messages = payload.messages.map((message) => addImages(message, find));
		}

		return false;
	});
}
