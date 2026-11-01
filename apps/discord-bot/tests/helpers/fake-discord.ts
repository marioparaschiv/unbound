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
	/** Every message edit request body that reached the fake. */
	edits: PostedBody[];
	/** Messages in the channel and every DM channel, oldest first. */
	messages: APIMessage[];
	/** The messages in the DM channel opened with a user, oldest first. */
	dms: (userId: string) => APIMessage[];
	/** Users whose DMs Discord refuses with 50007, as when they block the bot. */
	closedDms: Set<string>;
	/** While set, every message create is answered with a 500. */
	outage: boolean;
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
const MESSAGES_ROUTE = /^\/channels\/(\d+)\/messages(?:\/(\d+))?$/;
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
	const edits: PostedBody[] = [];
	const messages: APIMessage[] = [];
	const byNonce = new Map<string, APIMessage>();
	// Recipient id → DM channel id; one DM channel per user, as Discord keeps.
	const dmChannels = new Map<string, string>();
	const closedDms = new Set<string>();
	let nextId = 1000n;
	let nextChannelId = 5000n;
	const limitedPositions = new Set<number>();
	const rejectedPositions = new Set<number>();
	let limited = 0;

	function recipientOf(channel: string) {
		return [...dmChannels].find(([, id]) => id === channel)?.[0];
	}

	function append(author: APIUser, body: PostedBody, channel: string = channelId) {
		const message: APIMessage = {
			id: String(nextId++),
			channel_id: channel,
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

	async function createMessage(request: Request, channel: string) {
		const body = (await request.json()) as PostedBody;
		const position = requests.push(body) - 1;

		if (fake.outage) {
			return Response.json({ message: 'Internal Server Error', code: 0 }, { status: 500 });
		}

		if (closedDms.has(recipientOf(channel) ?? '')) {
			return Response.json(
				{ message: 'Cannot send messages to this user', code: 50_007 },
				{ status: 403 },
			);
		}

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

		const message = append(botUser, body, channel);

		if (body.nonce) {
			byNonce.set(body.nonce, message);
		}

		return Response.json(message);
	}

	async function editMessage(request: Request, messageId: string) {
		const body = (await request.json()) as PostedBody;
		const message = messages.find((entry) => entry.id === messageId);

		edits.push(body);

		if (!message) {
			return Response.json({ message: 'Unknown Message', code: 10_008 }, { status: 404 });
		}

		message.embeds = body.embeds ?? message.embeds;
		message.edited_timestamp = new Date().toISOString();

		return Response.json(message);
	}

	function listMessages(url: URL, channel: string) {
		const limit = Number(url.searchParams.get('limit') ?? 50);

		return Response.json(
			messages
				.filter((message) => message.channel_id === channel)
				.toReversed()
				.slice(0, limit),
		);
	}

	async function openDm(request: Request) {
		const { recipient_id: recipient } = (await request.json()) as { recipient_id: string };
		const id = dmChannels.get(recipient) ?? String(nextChannelId++);

		dmChannels.set(recipient, id);

		return Response.json({
			id,
			type: 1,
			last_message_id: null,
			recipients: [user(recipient, `user-${recipient}`, false)],
		});
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

			if (path === '/users/@me/channels' && request.method === 'POST') {
				return openDm(request);
			}

			const [, channel = '', messageId] = MESSAGES_ROUTE.exec(path) ?? [];
			const known = channel === channelId || recipientOf(channel) !== undefined;

			if (known && !messageId && request.method === 'POST') {
				return createMessage(request, channel);
			}

			if (known && !messageId && request.method === 'GET') {
				return listMessages(url, channel);
			}

			if (known && messageId && request.method === 'PATCH') {
				return editMessage(request, messageId);
			}

			return Response.json({ message: 'Unknown route', code: 0 }, { status: 404 });
		},
	});

	const fake: FakeDiscord = {
		url: server.url.origin,
		channelId,
		botUser,
		requests,
		edits,
		messages,
		dms: (userId) =>
			messages.filter((message) => message.channel_id === dmChannels.get(userId)),
		closedDms,
		outage: false,
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

	return fake;
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
