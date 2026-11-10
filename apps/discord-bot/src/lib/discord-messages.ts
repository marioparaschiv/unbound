import type {
	APIChannel,
	APIMessage,
	RawFile,
	REST,
	RESTPostAPIChannelMessageJSONBody,
} from 'discord.js';
import { DiscordAPIError, RESTJSONErrorCodes, Routes } from 'discord.js';
import { randomBytes } from 'node:crypto';

// `gone`: the message, member or channel no longer exists. `forbidden`: the bot lacks a permission.
// `undeliverable`: the user blocks the bot, shares no server with it, or no longer exists.
// `rejected`: Discord refused the body and would refuse it again.
/** How a Discord request failed, as far as a caller can act on it. */
export type DiscordFailure = 'gone' | 'undeliverable' | 'rejected' | 'forbidden';

export type OutgoingMessage = {
	body: RESTPostAPIChannelMessageJSONBody;
	/** The files the body's `attachments` name, in order. */
	files?: RawFile[];
};

export type PostOptions = {
	/** Dedupes a retried post; a random one is used without it. */
	nonce?: string;
	/** Posted instead once when Discord rejects the message, so one bad body cannot block what follows. */
	fallback?: OutgoingMessage;
};

/** The bot's messages on Discord: every send, edit, delete and listing goes through here. */
export type MessageGateway = {
	/** Posts once per nonce, Discord enforcing it, so a retried request posts once; resolves to the message id. */
	post: (channelId: string, message: OutgoingMessage, options?: PostOptions) => Promise<string>;
	/** Posts in the DM channel with a user, as `post` does. */
	dm: (userId: string, message: OutgoingMessage, options?: PostOptions) => Promise<string>;
	/** Replaces a message's content; what the new body leaves out is cleared. */
	edit: (channelId: string, messageId: string, message: OutgoingMessage) => Promise<void>;
	exists: (channelId: string, messageId: string) => Promise<boolean>;
	/** Deletes a message; one that is already gone counts as deleted. */
	delete: (channelId: string, messageId: string) => Promise<void>;
	/** Every message the bot posted in a channel, paging through its whole history, oldest first. */
	listOwn: (channelId: string) => Promise<APIMessage[]>;
	/** The bot's messages among the channel's newest `limit`, newest first. */
	recentOwn: (channelId: string, limit: number) => Promise<APIMessage[]>;
};

const PAGE_LIMIT = 100;
const UNDELIVERABLE = new Set<unknown>([
	RESTJSONErrorCodes.CannotSendMessagesToThisUser,
	RESTJSONErrorCodes.UnknownUser,
]);
const BY_STATUS: Readonly<Record<number, DiscordFailure>> = {
	400: 'rejected',
	403: 'forbidden',
	404: 'gone',
};

function newest(ids: string[]) {
	return ids.reduce((max, id) => (BigInt(id) > BigInt(max) ? id : max), '0');
}

function oldestFirst(a: APIMessage, b: APIMessage) {
	return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
}

/**
 * @description Classifies a failed Discord request.
 * @param error The thrown value.
 * @returns What the failure means, or undefined for one a retry may fix and anything not from Discord.
 */
export function discordFailure(
	// UNKNOWN: a caught value, which may be anything thrown.
	error: unknown,
): DiscordFailure | undefined {
	if (!(error instanceof DiscordAPIError)) return;

	if (UNDELIVERABLE.has(error.code)) {
		return 'undeliverable';
	}

	return BY_STATUS[error.status];
}

/**
 * @description Names one event's post, so a retry or a restart before its row was stored posts once.
 * @param prefix Tells the consumers of one event stream apart.
 * @param id The event id.
 * @param createdAt The event's creation time; it keeps a rebuilt database from colliding with an old post.
 * @returns The nonce, within Discord's 25 characters.
 */
export function eventNonce(prefix: string, id: number, createdAt: Date): string {
	return `${prefix}${id}.${createdAt.getTime().toString(36)}`;
}

/**
 * @description Creates the gateway to the bot's Discord messages.
 * @param rest The Discord REST client.
 * @param selfId The bot's own user id, which marks its messages.
 * @returns The gateway.
 */
export function createMessageGateway(rest: REST, selfId: string): MessageGateway {
	async function send(channelId: string, message: OutgoingMessage, nonce: string) {
		// REST retries a timed-out post with this body, and Discord answers a repeated nonce with the original.
		const body = { ...message.body, nonce, enforce_nonce: true };
		const posted = (await rest.post(Routes.channelMessages(channelId), {
			body,
			files: message.files,
		})) as APIMessage;

		return posted.id;
	}

	async function post(channelId: string, message: OutgoingMessage, options: PostOptions = {}) {
		const { nonce = randomBytes(12).toString('hex'), fallback } = options;

		try {
			return await send(channelId, message, nonce);
		} catch (error) {
			if (!fallback || discordFailure(error) !== 'rejected') {
				throw error;
			}

			return send(channelId, fallback, nonce);
		}
	}

	return {
		post,
		async dm(userId, message, options) {
			const channel = (await rest.post(Routes.userChannels(), {
				body: { recipient_id: userId },
			})) as APIChannel;

			return post(channel.id, message, options);
		},
		async edit(channelId, messageId, message) {
			await rest.patch(Routes.channelMessage(channelId, messageId), {
				body: { content: '', embeds: [], ...message.body },
				files: message.files,
			});
		},
		async exists(channelId, messageId) {
			try {
				await rest.get(Routes.channelMessage(channelId, messageId));

				return true;
			} catch (error) {
				if (discordFailure(error) !== 'gone') {
					throw error;
				}

				return false;
			}
		},
		async delete(channelId, messageId) {
			try {
				await rest.delete(Routes.channelMessage(channelId, messageId));
			} catch (error) {
				if (discordFailure(error) !== 'gone') {
					throw error;
				}
			}
		},
		async listOwn(channelId) {
			const own: APIMessage[] = [];
			let cursor = '0';
			let page: APIMessage[];

			do {
				const query = new URLSearchParams({ after: cursor, limit: String(PAGE_LIMIT) });

				page = (await rest.get(Routes.channelMessages(channelId), {
					query,
				})) as APIMessage[];
				cursor = newest([cursor, ...page.map((message) => message.id)]);
				own.push(...page.filter((message) => message.author.id === selfId));
			} while (page.length === PAGE_LIMIT);

			return own.sort(oldestFirst);
		},
		async recentOwn(channelId, limit) {
			const query = new URLSearchParams({ limit: String(limit) });
			const page = (await rest.get(Routes.channelMessages(channelId), {
				query,
			})) as APIMessage[];

			return page.filter((message) => message.author.id === selfId);
		},
	};
}

export default { discordFailure, eventNonce, createMessageGateway };
