import type { APIEmbed, APIMessage, REST, RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import { DiscordAPIError, RESTJSONErrorCodes, Routes } from 'discord.js';
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

// Fonts have no channel, so they are never posted.
export const ADDON_CHANNELS: AddonChannels = {
	plugin: PLUGINS_CHANNEL_ID,
	theme: THEMES_CHANNEL_ID,
	'icon-pack': ICON_PACKS_CHANNEL_ID,
};

const PAGE_LIMIT = 100;
// Discord rejects a longer value, which would fail the post on every retry.
const TITLE_LIMIT = 256;
const DESCRIPTION_LIMIT = 4096;
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
	const body = renderAddon(item);
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

async function ownMessagesAfter(rest: REST, channelId: string, selfId: string, after: string) {
	const own: APIMessage[] = [];
	let cursor = after;
	let page: APIMessage[];

	do {
		const query = new URLSearchParams({ after: cursor, limit: String(PAGE_LIMIT) });

		page = (await rest.get(Routes.channelMessages(channelId), { query })) as APIMessage[];
		cursor = newest([cursor, ...page.map((message) => message.id)]);
		own.push(...page.filter((message) => message.author.id === selfId));
	} while (page.length === PAGE_LIMIT);

	return own.sort(oldestFirst);
}

// Posts are serial and a crash stops all posting until the startup reconcile, so a message posted
// without its row being written is one of ours newer than every stored id in its channel.
async function adoptOrphans(db: Database, rest: REST, selfId: string, channels: AddonChannels) {
	const [addons, messages] = await Promise.all([
		db.select().from(addon),
		db.select().from(addonMessage),
	]);
	const stored = new Set(messages.map((message) => message.addonId));
	const channelIds = new Set(Object.values(channels).filter((id) => id !== undefined));

	for (const channelId of channelIds) {
		const unposted = new Map(
			addons
				.filter((row) => !stored.has(row.id) && desiredChannel(row, channels) === channelId)
				.map((row) => [row.data.pageUrl, row.id]),
		);
		const after = newest(
			messages.filter((row) => row.channelId === channelId).map((row) => row.messageId),
		);

		for (const message of await ownMessagesAfter(rest, channelId, selfId, after)) {
			const url = message.embeds[0]?.url;
			const addonId = url ? unposted.get(url) : undefined;

			if (!url || !addonId) {
				await deleteMessage(rest, channelId, message.id);

				continue;
			}

			unposted.delete(url);
			// An empty hash makes the following sync patch the message to the current content.
			await db.insert(addonMessage).values({
				addonId,
				channelId,
				messageId: message.id,
				postedHash: '',
			});
		}
	}
}

/**
 * @description Brings one addon's Discord message in line with its row: posted, edited, moved or removed.
 * @param db The bot database.
 * @param rest The Discord REST client.
 * @param id The addon id.
 * @param channels The channel each addon type posts to.
 * @returns Resolves once the message and its row match the addon.
 */
export async function syncAddon(
	db: Database,
	rest: REST,
	id: string,
	channels: AddonChannels = ADDON_CHANNELS,
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

	if (posted?.channelId === channelId && (await messageExists(rest, posted))) {
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

	const values = {
		channelId,
		messageId: await postMessage(rest, channelId, current.data),
		postedHash: current.contentHash,
		postedAt: new Date(),
		editedAt: null,
	};

	await db
		.insert(addonMessage)
		.values({ addonId: id, ...values })
		.onConflictDoUpdate({ target: addonMessage.addonId, set: values });
}

/**
 * @description Adopts messages a crash left without a row, then syncs every addon that has or had a message.
 * @param db The bot database.
 * @param rest The Discord REST client.
 * @param selfId The bot's own user id.
 * @param channels The channel each addon type posts to.
 * @returns Resolves once every addon's message matches its row.
 */
export async function reconcileAddons(
	db: Database,
	rest: REST,
	selfId: string,
	channels: AddonChannels = ADDON_CHANNELS,
): Promise<void> {
	await adoptOrphans(db, rest, selfId, channels);

	const ids = await db
		.select({ id: addon.id })
		.from(addon)
		.union(db.select({ id: addonMessage.addonId }).from(addonMessage));

	for (const { id } of ids) {
		await syncAddon(db, rest, id, channels);
	}
}

export const addonsDispatcher: Dispatcher = {
	name: 'addons',
	channel: 'addon_changed',
	reconcile: ({ db, client }) => reconcileAddons(db, client.rest, client.user.id),
	handle: (id, { db, client }) => syncAddon(db, client.rest, id),
};

export default { ADDON_CHANNELS, renderAddon, syncAddon, reconcileAddons, addonsDispatcher };
