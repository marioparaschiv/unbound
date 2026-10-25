import type { APIEmbed, APIMessage, APIUser } from 'discord.js';
import { Client, ClientUser } from 'discord.js';

export type PostedBody = {
	content?: string;
	embeds?: APIEmbed[];
	allowed_mentions?: AllowedMentions;
	nonce?: string;
	enforce_nonce?: boolean;
};

type AllowedMentions = { parse?: string[] };

export type FakeDiscord = {
	/** The base URL to hand discord.js as `rest.api`. */
	url: string;
	/** The id of the one sendable (DM) channel the fake serves. */
	channelId: string;
	botUser: APIUser;
	/** Every message create request body that reached the fake, 429s included. */
	requests: PostedBody[];
	/** Messages in the channel, oldest first. */
	messages: APIMessage[];
	/** How many requests were answered with a 429. */
	rateLimited: () => number;
	/** Answers the message create requests at these 0-based positions in `requests` with a 429. */
	rateLimitAt: (positions: number[]) => void;
	/** Answers the message create requests at these 0-based positions in `requests` with a 400. */
	rejectAt: (positions: number[]) => void;
	/** Appends a message as if another user had sent it. */
	inject: (author: APIUser, body: PostedBody) => APIMessage;
	stop: () => void;
};

const API_VERSION_PREFIX = /^\/v\d+/;
const RETRY_AFTER_SECONDS = 0.05;

// Lets a test hold a ClientUser without a gateway READY; discord.js keeps the constructor protected.
class FakeClientUser extends ClientUser {
	constructor(client: Client<true>, data: APIUser) {
		super(client, data);
	}
}

function user(id: string, username: string, bot: boolean): APIUser {
	return { id, username, discriminator: '0', global_name: null, avatar: null, bot };
}

function rateLimitResponse() {
	return Response.json(
		{ message: 'You are being rate limited.', retry_after: RETRY_AFTER_SECONDS, global: false },
		{
			status: 429,
			headers: {
				'retry-after': String(RETRY_AFTER_SECONDS),
				'x-ratelimit-limit': '5',
				'x-ratelimit-remaining': '0',
				'x-ratelimit-reset-after': String(RETRY_AFTER_SECONDS),
				'x-ratelimit-bucket': 'fake-messages',
				'x-ratelimit-scope': 'user',
			},
		},
	);
}

/**
 * @description Serves the slice of Discord's REST API that posting to one channel uses, on a local port.
 * @returns The fake's URL, channel, bot user, what it received, and controls to rate limit or stop it.
 */
export function createFakeDiscord(): FakeDiscord {
	const channelId = '100';
	const botUser = user('900', 'unbound-bot', true);
	const requests: PostedBody[] = [];
	const messages: APIMessage[] = [];
	const byNonce = new Map<string, APIMessage>();
	let nextId = 1000n;
	const limitedPositions = new Set<number>();
	const rejectedPositions = new Set<number>();
	let limited = 0;

	function append(author: APIUser, body: PostedBody) {
		const message: APIMessage = {
			id: String(nextId++),
			channel_id: channelId,
			author,
			content: body.content ?? '',
			timestamp: new Date().toISOString(),
			edited_timestamp: null,
			tts: false,
			mention_everyone: false,
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: body.embeds ?? [],
			pinned: false,
			type: 0,
		};

		messages.push(message);

		return message;
	}

	async function createMessage(request: Request) {
		const body = (await request.json()) as PostedBody;
		const position = requests.push(body) - 1;

		if (limitedPositions.has(position)) {
			limited++;

			return rateLimitResponse();
		}

		if (rejectedPositions.has(position)) {
			return Response.json({ message: 'Invalid Form Body', code: 50_035 }, { status: 400 });
		}

		const earlier = body.nonce && body.enforce_nonce ? byNonce.get(body.nonce) : undefined;

		if (earlier) {
			return Response.json(earlier);
		}

		const message = append(botUser, body);

		if (body.nonce) {
			byNonce.set(body.nonce, message);
		}

		return Response.json(message);
	}

	function listMessages(url: URL) {
		const limit = Number(url.searchParams.get('limit') ?? 50);

		return Response.json(messages.toReversed().slice(0, limit));
	}

	const server = Bun.serve({
		port: 0,
		async fetch(request) {
			const url = new URL(request.url);
			const path = url.pathname.replace(API_VERSION_PREFIX, '');

			if (path === `/channels/${channelId}` && request.method === 'GET') {
				return Response.json({
					id: channelId,
					type: 1,
					last_message_id: null,
					recipients: [user('200', 'moderator', false)],
				});
			}

			if (path === `/channels/${channelId}/messages` && request.method === 'POST') {
				return createMessage(request);
			}

			if (path === `/channels/${channelId}/messages` && request.method === 'GET') {
				return listMessages(url);
			}

			return Response.json({ message: 'Unknown route', code: 0 }, { status: 404 });
		},
	});

	return {
		url: server.url.origin,
		channelId,
		botUser,
		requests,
		messages,
		rateLimited: () => limited,
		rateLimitAt(positions) {
			for (const position of positions) {
				limitedPositions.add(position);
			}
		},
		rejectAt(positions) {
			for (const position of positions) {
				rejectedPositions.add(position);
			}
		},
		inject: append,
		stop() {
			void server.stop(true);
		},
	};
}

/**
 * @description Builds a real discord.js client whose REST calls go to the fake, logged in as its bot user.
 * @param fake The fake Discord to talk to.
 * @returns A client usable as a dispatcher's `client`; call `destroy()` when done.
 */
export function createFakeClient(fake: FakeDiscord): Client<true> {
	const client = new Client<true>({ intents: [], rest: { api: fake.url } });

	client.rest.setToken('fake');
	client.user = new FakeClientUser(client, fake.botUser);

	return client;
}
