import { flux } from '@unbound-app/api';

import { findBoards } from '~/lib/boards';
import { withBoards, type MessageEmbed } from '~/lib/embeds';

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

function storedContent({ id, channel_id }: ReceivedMessage): string | undefined {
	if (!id || !channel_id) return undefined;

	const store = flux.getStore('Message') as unknown as MessageLookup | undefined;

	return store?.getMessage?.(channel_id, id)?.content;
}

function addBoards(message: ReceivedMessage, content = message.content): ReceivedMessage {
	const boards = content ? findBoards(content) : [];

	if (!boards.length) return message;

	return { ...message, embeds: withBoards(message.embeds ?? [], boards) };
}

function addBoardsToUpdate(message: ReceivedMessage): ReceivedMessage {
	if (message.content === undefined && !message.embeds) return message;

	return addBoards(message, message.content ?? storedContent(message));
}

export function start() {
	flux.interceptAction('MESSAGE_CREATE', (action) => {
		const payload = action as MessageAction;

		if (payload.message) payload.message = addBoards(payload.message);

		return false;
	});

	flux.interceptAction('MESSAGE_UPDATE', (action) => {
		const payload = action as MessageAction;

		if (payload.message) payload.message = addBoardsToUpdate(payload.message);

		return false;
	});

	flux.interceptAction('LOAD_MESSAGES_SUCCESS', (action) => {
		const payload = action as MessagesAction;

		if (Array.isArray(payload.messages)) {
			payload.messages = payload.messages.map((message) => addBoards(message));
		}

		return false;
	});
}

export function stop() {}
