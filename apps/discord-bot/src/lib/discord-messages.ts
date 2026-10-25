import type { APIMessage, REST, RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import { DiscordAPIError, RESTJSONErrorCodes, Routes } from 'discord.js';
import { randomBytes } from 'node:crypto';

const PAGE_LIMIT = 100;

function newest(ids: string[]) {
	return ids.reduce((max, id) => (BigInt(id) > BigInt(max) ? id : max), '0');
}

function oldestFirst(a: APIMessage, b: APIMessage) {
	return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
}

/**
 * @description Shortens text to a Discord length limit, marking the cut with an ellipsis.
 * @param text The text to fit.
 * @param max The limit in characters.
 * @returns The text, or its first `max - 1` characters and an ellipsis.
 */
export function truncate(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description Tells whether a REST failure means the message no longer exists.
 * @param error The thrown value.
 * @returns Whether it is Discord's unknown message error.
 */
export function isUnknownMessage(error: unknown): error is DiscordAPIError {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage;
}

/**
 * @description Posts a message with a fresh nonce Discord enforces, so a retried request posts once.
 * @param rest The Discord REST client.
 * @param channelId The channel to post in.
 * @param body The message body.
 * @returns The posted message's id.
 */
export async function postMessage(
	rest: REST,
	channelId: string,
	body: RESTPostAPIChannelMessageJSONBody,
): Promise<string> {
	// REST retries a timed-out post with this body, and Discord answers a repeated nonce with the original.
	const payload = { ...body, nonce: randomBytes(12).toString('hex'), enforce_nonce: true };
	const message = (await rest.post(Routes.channelMessages(channelId), {
		body: payload,
	})) as APIMessage;

	return message.id;
}

/**
 * @description Checks whether a message still exists.
 * @param rest The Discord REST client.
 * @param channelId The message's channel.
 * @param messageId The message id.
 * @returns Whether Discord still has the message.
 */
export async function messageExists(
	rest: REST,
	channelId: string,
	messageId: string,
): Promise<boolean> {
	try {
		await rest.get(Routes.channelMessage(channelId, messageId));

		return true;
	} catch (error) {
		if (!isUnknownMessage(error)) {
			throw error;
		}

		return false;
	}
}

/**
 * @description Deletes a message, treating one that is already gone as deleted.
 * @param rest The Discord REST client.
 * @param channelId The message's channel.
 * @param messageId The message id.
 * @returns Resolves once the message is gone.
 */
export async function deleteMessage(
	rest: REST,
	channelId: string,
	messageId: string,
): Promise<void> {
	try {
		await rest.delete(Routes.channelMessage(channelId, messageId));
	} catch (error) {
		if (!isUnknownMessage(error)) {
			throw error;
		}
	}
}

/**
 * @description Lists every message an author posted in a channel, paging through its whole history.
 * @param rest The Discord REST client.
 * @param channelId The channel to list.
 * @param authorId The author to keep, usually the bot itself.
 * @returns The author's messages, oldest first.
 */
export async function listOwnMessages(
	rest: REST,
	channelId: string,
	authorId: string,
): Promise<APIMessage[]> {
	const own: APIMessage[] = [];
	let cursor = '0';
	let page: APIMessage[];

	do {
		const query = new URLSearchParams({ after: cursor, limit: String(PAGE_LIMIT) });

		page = (await rest.get(Routes.channelMessages(channelId), { query })) as APIMessage[];
		cursor = newest([cursor, ...page.map((message) => message.id)]);
		own.push(...page.filter((message) => message.author.id === authorId));
	} while (page.length === PAGE_LIMIT);

	return own.sort(oldestFirst);
}

export default {
	truncate,
	isUnknownMessage,
	postMessage,
	messageExists,
	deleteMessage,
	listOwnMessages,
};
