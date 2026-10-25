import type { APIEmbed, APIMessage, REST, RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import { DiscordAPIError, RESTJSONErrorCodes, Routes } from 'discord.js';
import { createLogger } from '@unbound-app/logger';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';

import {
	COLOURS,
	ICON_PACKS_CHANNEL_ID,
	PLUGINS_CHANNEL_ID,
	THEMES_CHANNEL_ID,
} from '~/lib/constants';
import type { AddonFeedItem, AddonType } from '~/lib/feed/types';
import type { Dispatcher } from '~/dispatchers/types';
import { addon, addonMessage } from '~/db/schema';
import type { Database } from '~/db/database';

export type AddonChannels = { [K in AddonType]?: string };

type AddonRow = typeof addon.$inferSelect;
type AddonMessageRow = typeof addonMessage.$inferSelect;

const logger = createLogger('Bot', 'Addons');

// Fonts have no channel, so they are never posted.
export const ADDON_CHANNELS: AddonChannels = {
	plugin: PLUGINS_CHANNEL_ID,
	theme: THEMES_CHANNEL_ID,
	'icon-pack': ICON_PACKS_CHANNEL_ID,
};

const PAGE_LIMIT = 100;
// Discord rejects a longer value or an embed over 6000 characters in all, failing every retry.
const TITLE_LIMIT = 256;
const DESCRIPTION_LIMIT = 2048;
const FIELD_LIMIT = 1024;

function truncate(text: string, max: number) {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function isUnknownMessage(error: unknown): error is DiscordAPIError {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage;
}

function newest(ids: string[]) {
	return ids.reduce((max, id) => (BigInt(id) > BigInt(max) ? id : max), '0');
}

function oldestFirst(a: APIMessage, b: APIMessage) {
	return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
}

function desiredChannel(row: AddonRow, channels: AddonChannels) {
	return row.listed ? channels[row.type] : undefined;
}

/**
 * @description Renders an addon listing as a message body that can never ping anyone.
 * @param item The addon snapshot.
 * @returns The message body to post or patch.
 */
export function renderAddon(item: AddonFeedItem): RESTPostAPIChannelMessageJSONBody {
	const authors = item.authors.map((author) => author.name).join(', ') || 'Unknown';
	const embed: APIEmbed = {
		title: truncate(item.name, TITLE_LIMIT),
		url: item.pageUrl,
		description: item.description ? truncate(item.description, DESCRIPTION_LIMIT) : undefined,
		color: COLOURS.brand,
		fields: [
			{ name: 'Version', value: truncate(item.version, FIELD_LIMIT), inline: true },
			{ name: 'Authors', value: truncate(authors, FIELD_LIMIT), inline: true },
		],
		thumbnail: item.iconUrl ? { url: item.iconUrl } : undefined,
	};

	return { embeds: [embed], allowed_mentions: { parse: [] } };
}

async function postMessage(rest: REST, channelId: string, item: AddonFeedItem) {
	// REST retries a timed-out post with this body, and Discord answers a repeated nonce with the original.
	const body = {
		...renderAddon(item),
		nonce: randomBytes(12).toString('hex'),
		enforce_nonce: true,
	};
	const message = (await rest.post(Routes.channelMessages(channelId), { body })) as APIMessage;

	return message.id;
}

async function messageExists(rest: REST, posted: AddonMessageRow) {
	try {
		await rest.get(Routes.channelMessage(posted.channelId, posted.messageId));

		return true;
	} catch (error) {
		if (!isUnknownMessage(error)) {
			throw error;
		}

		return false;
	}
}

async function deleteMessage(rest: REST, channelId: string, messageId: string) {
	try {
		await rest.delete(Routes.channelMessage(channelId, messageId));
	} catch (error) {
		if (!isUnknownMessage(error)) {
			throw error;
		}
	}
}

async function ownMessages(rest: REST, channelId: string, selfId: string) {
	const own: APIMessage[] = [];
	let cursor = '0';
	let page: APIMessage[];

	do {
		const query = new URLSearchParams({ after: cursor, limit: String(PAGE_LIMIT) });

		page = (await rest.get(Routes.channelMessages(channelId), { query })) as APIMessage[];
		cursor = newest([cursor, ...page.map((message) => message.id)]);
		own.push(...page.filter((message) => message.author.id === selfId));
	} while (page.length === PAGE_LIMIT);

	return own.sort(oldestFirst);
}

async function storeMessage(
	db: Database,
	addonId: string,
	channelId: string,
	messageId: string,
	postedHash: string,
) {
	const values = { channelId, messageId, postedHash, postedAt: new Date(), editedAt: null };
	const [row] = await db
		.insert(addonMessage)
		.values({ addonId, ...values })
		.onConflictDoUpdate({ target: addonMessage.addonId, set: values })
		.returning();

	return row;
}

// A listed post of an addon that no row points at lost its row write. It is adopted when its addon
// belongs in that channel and has no message there yet, else it is a duplicate or stale and goes.
async function adoptOrphans(
	db: Database,
	rest: REST,
	channels: AddonChannels,
	listings: Map<string, APIMessage[]>,
) {
	const [addons, messages] = await Promise.all([
		db.select().from(addon),
		db.select().from(addonMessage),
	]);
	const byUrl = new Map(addons.map((row) => [row.data.pageUrl, row]));
	const rows = new Map(messages.map((row) => [row.addonId, row]));
	const referenced = new Set(messages.map((row) => row.messageId));

	for (const [channelId, listing] of listings) {
		for (const message of listing) {
			const url = message.embeds[0]?.url;
			const owner = url ? byUrl.get(url) : undefined;

			// A url that names no addon is not an addon post (a tag reply, an old bot's post), so it stays.
			if (!owner || referenced.has(message.id)) {
				continue;
			}

			const row = rows.get(owner.id);

			try {
				if (desiredChannel(owner, channels) !== channelId || row?.channelId === channelId) {
					await deleteMessage(rest, channelId, message.id);

					continue;
				}

				if (row) {
					await deleteMessage(rest, row.channelId, row.messageId);
				}

				// An empty hash makes the following sync patch the message to the current content.
				const adopted = await storeMessage(db, owner.id, channelId, message.id, '');

				if (adopted) {
					rows.set(owner.id, adopted);
				}
			} catch (error) {
				logger.error(`Failed to adopt message ${message.id} of addon ${owner.id}:`, error);
			}
		}
	}
}

/**
 * @description Brings one addon's Discord message in line with its row: posted, edited, moved or removed.
 * @param db The bot database.
 * @param rest The Discord REST client.
 * @param id The addon id.
 * @param channels The channel each addon type posts to.
 * @param present Ids of our messages that exist, from a listing; without it the message is fetched.
 * @returns Resolves once the message and its row match the addon.
 */
export async function syncAddon(
	db: Database,
	rest: REST,
	id: string,
	channels: AddonChannels = ADDON_CHANNELS,
	present?: ReadonlySet<string>,
): Promise<void> {
	const [[current], [posted]] = await Promise.all([
		db.select().from(addon).where(eq(addon.id, id)),
		db.select().from(addonMessage).where(eq(addonMessage.addonId, id)),
	]);
	const channelId = current ? desiredChannel(current, channels) : undefined;

	// A delisted addon loses its message, and relisting announces it afresh. Discord goes first, so
	// a crash in between leaves a row whose message is already gone, which the next sync clears.
	if (!current || !channelId) {
		if (posted) {
			await deleteMessage(rest, posted.channelId, posted.messageId);
			await db.delete(addonMessage).where(eq(addonMessage.addonId, id));
		}

		return;
	}

	const kept =
		posted?.channelId === channelId &&
		(present?.has(posted.messageId) ?? (await messageExists(rest, posted)));

	if (posted && kept) {
		if (posted.postedHash === current.contentHash) return;

		await rest.patch(Routes.channelMessage(channelId, posted.messageId), {
			body: renderAddon(current.data),
		});
		await db
			.update(addonMessage)
			.set({ postedHash: current.contentHash, editedAt: new Date() })
			.where(eq(addonMessage.addonId, id));

		return;
	}

	if (posted) {
		await deleteMessage(rest, posted.channelId, posted.messageId);
	}

	const messageId = await postMessage(rest, channelId, current.data);

	try {
		await storeMessage(db, id, channelId, messageId, current.contentHash);
	} catch (error) {
		// A post without its row would be duplicated by the next sync; reconcile adopts it if this fails.
		await deleteMessage(rest, channelId, messageId).catch((cleanup) => {
			logger.warn(
				`Failed to remove unrecorded message ${messageId} of addon ${id}:`,
				cleanup,
			);
		});

		throw error;
	}
}

/**
 * @description Adopts messages a crash left without a row, then syncs every addon that has or had a message.
 * @param db The bot database.
 * @param rest The Discord REST client.
 * @param selfId The bot's own user id.
 * @param channels The channel each addon type posts to.
 * @returns Resolves once every addon was synced; one addon's failure is logged and left to the next run.
 */
export async function reconcileAddons(
	db: Database,
	rest: REST,
	selfId: string,
	channels: AddonChannels = ADDON_CHANNELS,
): Promise<void> {
	// One listing per channel replaces a fetch per message on every periodic run.
	const listings = new Map<string, APIMessage[]>();

	for (const channelId of new Set(Object.values(channels))) {
		if (channelId) {
			listings.set(channelId, await ownMessages(rest, channelId, selfId));
		}
	}

	const present = new Set([...listings.values()].flat().map((message) => message.id));

	await adoptOrphans(db, rest, channels, listings);

	const ids = await db
		.select({ id: addon.id })
		.from(addon)
		.union(db.select({ id: addonMessage.addonId }).from(addonMessage));

	for (const { id } of ids) {
		try {
			await syncAddon(db, rest, id, channels, present);
		} catch (error) {
			logger.error(`Failed to sync addon ${id}:`, error);
		}
	}
}

export const addonsDispatcher: Dispatcher = {
	name: 'addons',
	channel: 'addon_changed',
	reconcile: ({ db, client }) => reconcileAddons(db, client.rest, client.user.id),
	handle: (id, { db, client }) => syncAddon(db, client.rest, id),
};

export default { ADDON_CHANNELS, renderAddon, syncAddon, reconcileAddons, addonsDispatcher };
