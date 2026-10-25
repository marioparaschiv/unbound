import type { APIEmbed, APIMessage, RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import { REST } from 'discord.js';

export type FakeMessage = Pick<APIMessage, 'id' | 'channel_id' | 'author' | 'content' | 'embeds'> &
	Pick<RESTPostAPIChannelMessageJSONBody, 'allowed_mentions'>;

export type RecordedRequest = {
	method: string;
	channelId: string;
	messageId?: string;
	body?: RESTPostAPIChannelMessageJSONBody;
};

export type FakeDiscordOptions = {
	/** The user id of the bot that `rest` authenticates as. */
	selfId?: string;
	/** How many times `rest` retries a request that timed out or failed with a 5xx. */
	retries?: number;
	/** Milliseconds `rest` waits for a response before aborting the request. */
	timeout?: number;
};

export type FakeDiscord = {
	rest: REST;
	/** The bot's own user id; messages posted through `rest` carry it as author. */
	selfId: string;
	/** Every request `rest` made, in order. */
	requests: RecordedRequest[];
	/** Runs after a POST is stored and before its response is sent. */
	beforePostResponse: (() => Promise<void>) | undefined;
	/** Rejects a POST whose body it matches with Discord's invalid form body error. */
	rejectPost: ((body: RESTPostAPIChannelMessageJSONBody) => boolean) | undefined;
	/** Rejects a DELETE of a message it matches with Discord's missing permissions error. */
	rejectDelete: ((messageId: string) => boolean) | undefined;
	/** A channel's messages, oldest first. */
	messages: (channelId: string) => FakeMessage[];
	/** Adds a message as any author, bypassing `rest`. */
	seed: (channelId: string, authorId: string, body: RESTPostAPIChannelMessageJSONBody) => string;
	/** Deletes a message out of band, as a moderator would. */
	handDelete: (channelId: string, messageId: string) => void;
	stop: () => Promise<void>;
};

type Route = {
	channelId: string;
	messageId?: string;
};

const ROUTE = /^\/api\/v\d+\/channels\/(\d+)\/messages(?:\/(\d+))?$/;
const UNKNOWN_MESSAGE = { message: 'Unknown Message', code: 10_008 };
const INVALID_FORM_BODY = { message: 'Invalid Form Body', code: 50_035 };
const MISSING_PERMISSIONS = { message: 'Missing Permissions', code: 50_013 };
const EMBED_DESCRIPTION_LIMIT = 4096;
const EMBED_TOTAL_LIMIT = 6000;
// Starts one below a power of ten so ids change length, catching snowflakes compared as strings.
const FIRST_ID = 99_999_999_999_999_999n;

function parseRoute(pathname: string): Route | undefined {
	const match = ROUTE.exec(pathname);

	if (!match?.[1]) return;

	return { channelId: match[1], messageId: match[2] };
}

function byIdDescending(a: FakeMessage, b: FakeMessage) {
	return BigInt(b.id) > BigInt(a.id) ? 1 : -1;
}

/**
 * @description Counts the characters Discord adds up against its per-message embed limit.
 * @param embed The embed to measure.
 * @returns The embed's text length.
 */
export function embedLength(embed: APIEmbed): number {
	const fields = embed.fields ?? [];

	return [
		embed.title,
		embed.description,
		embed.footer?.text,
		embed.author?.name,
		...fields.flatMap((field) => [field.name, field.value]),
	].reduce((total, text) => total + (text?.length ?? 0), 0);
}

function isOversized(embeds: APIEmbed[]) {
	const total = embeds.reduce((sum, embed) => sum + embedLength(embed), 0);
	const description = embeds.some(
		(embed) => (embed.description?.length ?? 0) > EMBED_DESCRIPTION_LIMIT,
	);

	return description || total > EMBED_TOTAL_LIMIT;
}

/**
 * @description Serves the Discord message routes the dispatchers use from memory, behind a real `REST`.
 * @param options The bot's user id and the retry policy of `rest`.
 * @returns The client, the recorded requests and hooks to inspect and disturb the fake channels.
 */
export function createFakeDiscord(options: FakeDiscordOptions = {}): FakeDiscord {
	const { selfId = '1000', retries = 0, timeout = 15_000 } = options;
	const channels = new Map<string, Map<string, FakeMessage>>();
	// Discord dedupes an `enforce_nonce` post by its author and nonce; one bot authors every post here.
	const nonces = new Map<string, string>();
	const requests: RecordedRequest[] = [];
	let nextId = FIRST_ID;

	function channel(channelId: string) {
		let messages = channels.get(channelId);

		if (!messages) {
			messages = new Map();
			channels.set(channelId, messages);
		}

		return messages;
	}

	function store(channelId: string, authorId: string, body: RESTPostAPIChannelMessageJSONBody) {
		const id = String(nextId++);
		const embeds: APIEmbed[] = body.embeds ?? [];

		channel(channelId).set(id, {
			id,
			channel_id: channelId,
			author: {
				id: authorId,
				username: authorId,
				discriminator: '0',
				global_name: null,
				avatar: null,
			},
			content: body.content ?? '',
			embeds,
			allowed_mentions: body.allowed_mentions,
		});

		return id;
	}

	function list(channelId: string, query: URLSearchParams) {
		const after = BigInt(query.get('after') ?? '0');
		const limit = Number(query.get('limit') ?? 50);

		return [...channel(channelId).values()]
			.filter((message) => BigInt(message.id) > after)
			.sort(byIdDescending)
			.slice(-limit);
	}

	async function respond(request: Request) {
		const url = new URL(request.url);
		const route = parseRoute(url.pathname);

		if (!route) {
			return Response.json({ message: 'Not Found', code: 0 }, { status: 404 });
		}

		const { channelId, messageId } = route;
		const body = request.body
			? ((await request.json()) as RESTPostAPIChannelMessageJSONBody)
			: undefined;

		requests.push({ method: request.method, channelId, messageId, body });

		if (!messageId) {
			if (request.method === 'GET') {
				return Response.json(list(channelId, url.searchParams));
			}

			const nonce = body?.nonce === undefined ? undefined : `${channelId}:${body.nonce}`;
			const original = nonce ? channel(channelId).get(nonces.get(nonce) ?? '') : undefined;

			if (body?.enforce_nonce && original) {
				return Response.json(original);
			}

			if (fake.rejectPost?.(body ?? {}) || isOversized(body?.embeds ?? [])) {
				return Response.json(INVALID_FORM_BODY, { status: 400 });
			}

			const id = store(channelId, selfId, body ?? {});

			if (nonce) {
				nonces.set(nonce, id);
			}

			await fake.beforePostResponse?.();

			return Response.json(channel(channelId).get(id));
		}

		const message = channel(channelId).get(messageId);

		if (!message) {
			return Response.json(UNKNOWN_MESSAGE, { status: 404 });
		}

		switch (request.method) {
			case 'GET': {
				return Response.json(message);
			}

			case 'PATCH': {
				message.content = body?.content ?? message.content;
				message.embeds = body?.embeds ?? message.embeds;
				message.allowed_mentions = body?.allowed_mentions ?? message.allowed_mentions;

				return Response.json(message);
			}

			case 'DELETE': {
				if (fake.rejectDelete?.(messageId)) {
					return Response.json(MISSING_PERMISSIONS, { status: 403 });
				}

				channel(channelId).delete(messageId);

				return new Response(null, { status: 204 });
			}

			default: {
				return Response.json({ message: 'Method Not Allowed', code: 0 }, { status: 405 });
			}
		}
	}

	const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: respond });
	const rest = new REST({
		api: `http://127.0.0.1:${server.port}/api`,
		retries,
		timeout,
		handlerSweepInterval: 0,
		hashSweepInterval: 0,
	}).setToken('fake');
	const fake: FakeDiscord = {
		rest,
		selfId,
		requests,
		beforePostResponse: undefined,
		rejectPost: undefined,
		rejectDelete: undefined,
		messages: (channelId) => [...channel(channelId).values()].sort(byIdDescending).reverse(),
		seed: store,
		handDelete: (channelId, messageId) => void channel(channelId).delete(messageId),
		stop: async () => {
			await server.stop(true);
		},
	};

	return fake;
}

export default { createFakeDiscord, embedLength };
