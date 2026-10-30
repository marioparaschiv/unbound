import type { APIEmbed, APIMessage, REST, RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import type { AddonType } from '@unbound-app/contracts/addons';
import type { PublicAddon } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';
import { Routes } from 'discord.js';
import { eq } from 'drizzle-orm';

import {
	deleteMessage,
	listOwnMessages,
	messageExists,
	postMessage,
	truncate,
} from '~/lib/discord-messages';
import type { Dispatcher, Stores } from '~/dispatchers/types';
import { COLOURS, DISCORD_IDS } from '~/lib/constants';
import { contentHash } from '~/lib/content-hash';
import type { Database } from '~/db/database';
import { addonMessage } from '~/db/schema';

export type AddonChannels = { [K in AddonType]?: string };

const logger = createLogger('Bot', 'Addons');

// Fonts have no channel, so they are never posted.
export const ADDON_CHANNELS: AddonChannels = {
	plugin: DISCORD_IDS.PLUGINS_CHANNEL_ID,
	theme: DISCORD_IDS.THEMES_CHANNEL_ID,
	'icon-pack': DISCORD_IDS.ICON_PACKS_CHANNEL_ID,
};

// Discord rejects a longer value or an embed over 6000 characters in all, failing every retry.
const TITLE_LIMIT = 256;
const DESCRIPTION_LIMIT = 2048;
const FIELD_LIMIT = 1024;

/**
 * @description Names the channel an addon's message belongs in.
 * @param addon The addon's public listing.
 * @param channels The channel each addon type posts to.
 * @returns Its type's channel while listed, otherwise undefined: it has no message.
 */
export function desiredChannel(addon: PublicAddon, channels: AddonChannels): string | undefined {
	return addon.listed ? channels[addon.type] : undefined;
}

/**
 * @description Renders an addon listing as a message body that can never ping anyone.
 * @param item The addon's public listing.
 * @returns The message body to post or patch.
 */
export function renderAddon(item: PublicAddon): RESTPostAPIChannelMessageJSONBody {
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
	addons: PublicAddon[],
) {
	const messages = await db.select().from(addonMessage);
	const byUrl = new Map(addons.map((item) => [item.pageUrl, item]));
	const rows = new Map(messages.map((row) => [row.addonId, row]));
	const referenced = new Set(messages.map((row) => row.messageId));

	for (const [channelId, listing] of listings) {
		const listed = new Set(listing.map((message) => message.id));

		for (const message of listing) {
			const url = message.embeds[0]?.url;
			const owner = url ? byUrl.get(url) : undefined;

			// A url that names no addon is not an addon post (a tag reply, an old bot's post), so it stays.
			if (!owner || referenced.has(message.id)) {
				continue;
			}

			const row = rows.get(owner.id);

			try {
				const kept = row?.channelId === channelId && listed.has(row.messageId);

				// A row whose message is gone takes this post over instead of deleting it and posting anew.
				if (desiredChannel(owner, channels) !== channelId || kept) {
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
 * @description Brings one addon's Discord message in line with its listing: posted, edited, moved or removed.
 * @param stores The bot database and the web's reads.
 * @param rest The Discord REST client.
 * @param id The addon id.
 * @param channels The channel each addon type posts to.
 * @param present Ids of our messages that exist, from a listing; without it the message is fetched.
 * @returns Resolves once the message and its row match the addon.
 */
export async function syncAddon(
	{ db, web }: Stores,
	rest: REST,
	id: string,
	channels: AddonChannels = ADDON_CHANNELS,
	present?: ReadonlySet<string>,
): Promise<void> {
	const [current, [posted]] = await Promise.all([
		web.addon(id),
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

	const hash = contentHash(current);
	const kept =
		posted?.channelId === channelId &&
		(present?.has(posted.messageId) ??
			(await messageExists(rest, posted.channelId, posted.messageId)));

	if (posted && kept) {
		if (posted.postedHash === hash) return;

		await rest.patch(Routes.channelMessage(channelId, posted.messageId), {
			body: renderAddon(current),
		});
		await db
			.update(addonMessage)
			.set({ postedHash: hash, editedAt: new Date() })
			.where(eq(addonMessage.addonId, id));

		return;
	}

	if (posted) {
		await deleteMessage(rest, posted.channelId, posted.messageId);
	}

	const messageId = await postMessage(rest, channelId, renderAddon(current));

	try {
		await storeMessage(db, id, channelId, messageId, hash);
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
 * @param stores The bot database and the web's reads.
 * @param rest The Discord REST client.
 * @param selfId The bot's own user id.
 * @param channels The channel each addon type posts to.
 * @returns Resolves once every addon was synced; one addon's failure is logged and left to the next run.
 */
export async function reconcileAddons(
	stores: Stores,
	rest: REST,
	selfId: string,
	channels: AddonChannels = ADDON_CHANNELS,
): Promise<void> {
	// One listing per channel replaces a fetch per message on every periodic run.
	const listings = new Map<string, APIMessage[]>();

	for (const channelId of new Set(Object.values(channels))) {
		if (channelId) {
			listings.set(channelId, await listOwnMessages(rest, channelId, selfId));
		}
	}

	const present = new Set([...listings.values()].flat().map((message) => message.id));

	const addons = await stores.web.addons();

	await adoptOrphans(stores.db, rest, channels, listings, addons);

	const posted = await stores.db.select({ id: addonMessage.addonId }).from(addonMessage);
	const ids = new Set([...addons.map((item) => item.id), ...posted.map((row) => row.id)]);

	for (const id of ids) {
		try {
			await syncAddon(stores, rest, id, channels, present);
		} catch (error) {
			logger.error(`Failed to sync addon ${id}:`, error);
		}
	}
}

export const addonsDispatcher: Dispatcher = {
	name: 'addons',
	channel: 'addon_changed',
	requires: ['PLUGINS_CHANNEL_ID', 'THEMES_CHANNEL_ID', 'ICON_PACKS_CHANNEL_ID'],
	/**
	 * @description Syncs every addon message with the web's listings.
	 * @param context The dispatcher's stores and Discord client.
	 * @returns Resolves once every addon was synced.
	 */
	reconcile: (context) => reconcileAddons(context, context.client.rest, context.client.user.id),
	/**
	 * @description Syncs the message of the addon a NOTIFY payload names.
	 * @param id The addon id from the payload.
	 * @param context The dispatcher's stores and Discord client.
	 * @returns Resolves once the addon's message matches its listing.
	 */
	handle: (id, context) => syncAddon(context, context.client.rest, id),
};

export default {
	ADDON_CHANNELS,
	desiredChannel,
	renderAddon,
	syncAddon,
	reconcileAddons,
	addonsDispatcher,
};
