import {
	ChannelType,
	EmbedType,
	PermissionFlagsBits,
	type Client,
	type Embed,
	type Message,
	type PartialMessage,
} from 'discord.js';
import { createLogger } from '@unbound-app/logger';
import { eq } from 'drizzle-orm';

import { starboardEmojiNames, type StarboardEmojis } from '~/starboard/starboard-emojis';
import { createPostLedger, type LedgerRow, type MutableRows } from '~/lib/post-ledger';
import { discordFailure, type MessageGateway } from '~/lib/discord-messages';
import { renderStarPost, type StarredMessage } from '~/lib/star-post';
import createSerialQueue from '~/runtime/serial-queue';
import type { Database } from '~/db/database';
import { starPost } from '~/db/schema';

/** The emoji that stars a message. */
export const STAR = '⭐';

/** Stars a message needs to reach the starboard. */
export const STAR_THRESHOLD = 2;

export type StarboardOptions = {
	db: Database;
	messages: MessageGateway;
	emojis: StarboardEmojis;
	guildId: string;
	channelId: string;
};

/** Keeps one starboard post per message with enough stars. */
export type Starboard = {
	/** Recounts the stars of a message, or of the message a starboard post shows, and posts, edits or removes its post. */
	refresh: (message: Message | PartialMessage) => Promise<void>;
	/** Removes the post of a deleted message. */
	forget: (message: Message | PartialMessage) => Promise<void>;
};

type Source = { channelId: string; messageId: string };

const logger = createLogger('Bot', 'Starboard');
const PAGE_LIMIT = 100;

// Ledger keys name the starred message as `<channel id>/<message id>`, so a post leads back to it.
function keyOf({ channelId, messageId }: Source) {
	return `${channelId}/${messageId}`;
}

function sourceOf(key: string): Source {
	const [channelId = '', messageId = ''] = key.split('/');

	return { channelId, messageId };
}

function ledgerRow(row: typeof starPost.$inferSelect): LedgerRow {
	return { channelId: row.channelId, messageId: row.messageId, hash: row.postedHash };
}

const STAR_ROWS: MutableRows = {
	async list(db) {
		const rows = await db.select().from(starPost);

		return new Map(
			rows.map((row) => [
				keyOf({ channelId: row.sourceChannelId, messageId: row.sourceMessageId }),
				ledgerRow(row),
			]),
		);
	},
	async get(db, key) {
		const { messageId } = sourceOf(key);
		const [row] = await db
			.select()
			.from(starPost)
			.where(eq(starPost.sourceMessageId, messageId));

		return row && ledgerRow(row);
	},
	async insert(db, key, { channelId, messageId, hash }) {
		const source = sourceOf(key);
		const values = {
			channelId,
			messageId,
			postedHash: hash,
			postedAt: new Date(),
			editedAt: null,
		};

		await db
			.insert(starPost)
			.values({
				sourceMessageId: source.messageId,
				sourceChannelId: source.channelId,
				...values,
			})
			.onConflictDoUpdate({ target: starPost.sourceMessageId, set: values });
	},
	async update(db, key, { channelId, messageId, hash }) {
		await db
			.update(starPost)
			.set({ channelId, messageId, postedHash: hash, editedAt: new Date() })
			.where(eq(starPost.sourceMessageId, sourceOf(key).messageId));
	},
	async remove(db, key) {
		await db.delete(starPost).where(eq(starPost.sourceMessageId, sourceOf(key).messageId));
	},
};

async function fetchMessage(client: Client, { channelId, messageId }: Source) {
	try {
		const channel = await client.channels.fetch(channelId);

		return channel?.isTextBased() ? await channel.messages.fetch(messageId) : undefined;
	} catch (error) {
		if (discordFailure(error) !== 'gone') {
			throw error;
		}

		return undefined;
	}
}

// Every non-bot user who starred the message.
async function starrers(message: Message): Promise<string[]> {
	const reaction = message.reactions.resolve(STAR);

	if (!reaction) {
		return [];
	}

	const ids: string[] = [];
	let after: string | undefined;
	let size: number;

	do {
		const page = await reaction.users.fetch({ limit: PAGE_LIMIT, ...(after ? { after } : {}) });

		ids.push(...page.filter((user) => !user.bot).map((user) => user.id));
		after = page.lastKey();
		size = page.size;
	} while (size === PAGE_LIMIT);

	return ids;
}

// Only what anyone in the server can read reaches the starboard: no NSFW, staff or private thread messages.
function isPublic(message: Message<true>): boolean {
	const { channel } = message;
	const base = channel.isThread() ? channel.parent : channel;

	if (!base || ('nsfw' in base && base.nsfw) || channel.type === ChannelType.PrivateThread) {
		return false;
	}

	const everyone = message.guild.roles.everyone;

	return channel.permissionsFor(everyone).has(PermissionFlagsBits.ViewChannel);
}

function embedMedia(embed: Embed): string | undefined {
	const { type } = embed.data;

	if (type === EmbedType.GIFV) {
		return embed.video?.url ?? embed.thumbnail?.url;
	}

	if (type === EmbedType.Image) {
		return embed.thumbnail?.url ?? embed.url ?? undefined;
	}

	return embed.image?.url;
}

async function snapshot(message: Message<true>, emojis: StarboardEmojis): Promise<StarredMessage> {
	const media: StarredMessage['media'] = [];
	const files: StarredMessage['files'] = [];
	const shown = message.member ?? message.author;
	const avatarHash = message.member?.avatar ?? message.author.avatar;

	for (const attachment of message.attachments.values()) {
		const type = attachment.contentType ?? '';

		if (type.startsWith('image/') || type.startsWith('video/')) {
			media.push({
				url: attachment.url,
				spoiler: attachment.spoiler,
				...(attachment.description ? { description: attachment.description } : {}),
			});
		} else {
			files.push({ name: attachment.name, url: attachment.url });
		}
	}

	for (const embed of message.embeds) {
		const url = embedMedia(embed);

		if (url) {
			media.push({ url, spoiler: false });
		}
	}

	return {
		channelId: message.channelId,
		url: message.url,
		createdAt: message.createdAt,
		author: {
			name: shown.displayName,
			emoji: await emojis.avatar({
				id: message.author.id,
				avatarHash,
				avatarUrl: shown.displayAvatarURL({ extension: 'png', size: 128 }),
			}),
		},
		// The guild's own emojis show as they are; any other is copied to the bot.
		content: await emojis.mirror(message.content, new Set(message.guild.emojis.cache.keys())),
		media,
		files,
	};
}

function hashOf(serialized: string) {
	return new Bun.CryptoHasher('sha256').update(serialized).digest('hex');
}

/**
 * @description Creates the starboard: a message with enough stars gets a post, kept in step as its stars change.
 * @param options The database, the bot's Discord messages, the guild and the starboard channel.
 * @returns The starboard; it handles one message at a time, so racing reactions never double post.
 */
export function createStarboard({
	db,
	messages,
	emojis,
	guildId,
	channelId,
}: StarboardOptions): Starboard {
	const ledger = createPostLedger({
		messages,
		label: 'starred message',
		policy: 'mutable',
		rows: STAR_ROWS,
	});
	const queue = createSerialQueue();

	async function sourceKey(message: Message | PartialMessage): Promise<string | undefined> {
		if (message.channelId !== channelId) {
			return keyOf({ channelId: message.channelId, messageId: message.id });
		}

		// A star on a starboard post counts for the message it shows.
		const [row] = await db.select().from(starPost).where(eq(starPost.messageId, message.id));

		return row && keyOf({ channelId: row.sourceChannelId, messageId: row.sourceMessageId });
	}

	async function stars(source: Message, key: string) {
		const row = await STAR_ROWS.get(db, key);
		const post = row ? await fetchMessage(source.client, row) : undefined;
		const users = new Set([...(await starrers(source)), ...(post ? await starrers(post) : [])]);

		// Starring your own message does not count.
		users.delete(source.author.id);

		return users.size;
	}

	// Records the emojis a post shows, then deletes the starboard emojis no post shows any more.
	async function keepEmojis(key: string, names: readonly string[]) {
		await db
			.update(starPost)
			.set({ emojis: [...names] })
			.where(eq(starPost.sourceMessageId, sourceOf(key).messageId));

		const rows = await db.select({ emojis: starPost.emojis }).from(starPost);

		await emojis.prune(new Set(rows.flatMap((row) => row.emojis)));
	}

	async function unpost(key: string) {
		// Most messages never had a post; they cost one lookup.
		if (!(await STAR_ROWS.get(db, key))) {
			return;
		}

		await ledger.sync(db, key, undefined);
		await keepEmojis(key, []);
	}

	async function sync(client: Client, key: string) {
		const source = await fetchMessage(client, sourceOf(key));

		// The bot's own messages never reach the starboard, as Carl-bot's never did.
		if (
			!source?.inGuild() ||
			source.guildId !== guildId ||
			source.author.id === client.user?.id ||
			!isPublic(source)
		) {
			await unpost(key);

			return;
		}

		const count = await stars(source, key);

		if (count < STAR_THRESHOLD) {
			await unpost(key);

			return;
		}

		const post = renderStarPost(await snapshot(source, emojis), count);
		const serialized = JSON.stringify(post.body);

		await ledger.sync(db, key, {
			channelId,
			hash: hashOf(serialized),
			render: async () => post,
		});
		await keepEmojis(key, starboardEmojiNames(serialized));
	}

	return {
		async refresh(message) {
			if (message.guildId !== guildId) return;

			try {
				await queue.enqueue(async () => {
					const key = await sourceKey(message);

					if (key) {
						await sync(message.client, key);
					}
				});
			} catch (error) {
				logger.error(`Failed to refresh the stars of message ${message.id}:`, error);
			}
		},
		async forget(message) {
			if (message.guildId !== guildId || message.channelId === channelId) return;

			const key = keyOf({ channelId: message.channelId, messageId: message.id });

			try {
				await queue.enqueue(() => unpost(key));
			} catch (error) {
				logger.error(
					`Failed to remove the starboard post of message ${message.id}:`,
					error,
				);
			}
		},
	};
}

export default { STAR, STAR_THRESHOLD, createStarboard };
