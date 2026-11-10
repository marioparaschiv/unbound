import type { AddonType } from '@unbound-app/contracts/addons';
import type { PublicAddon } from '@unbound-app/web/bot';
import type { APIMessage, Client } from 'discord.js';
import { createLogger } from '@unbound-app/logger';
import { eq } from 'drizzle-orm';

import {
	createMessageGateway,
	discordFailure,
	type MessageGateway,
	type OutgoingMessage,
} from '~/lib/discord-messages';
import { messageLinks, renderAddon, renderCardImages } from '~/dispatchers/addon-card';
import { createAuthorEmojis, type AuthorEmojis } from '~/lib/author-emojis';
import type { Dispatcher, Stores } from '~/dispatchers/types';
import { contentHash } from '~/lib/content-hash';
import type { Database } from '~/db/database';
import { DISCORD_IDS } from '~/lib/constants';
import { addonMessage } from '~/db/schema';

export type AddonChannels = { [K in AddonType]?: string };

const logger = createLogger('Bot', 'Addons');

// Fonts have no channel, so they are never posted.
export const ADDON_CHANNELS: AddonChannels = {
	plugin: DISCORD_IDS.PLUGINS_CHANNEL_ID,
	theme: DISCORD_IDS.THEMES_CHANNEL_ID,
	'icon-pack': DISCORD_IDS.ICON_PACKS_CHANNEL_ID,
};

/**
 * @description Names the channel an addon's message belongs in.
 * @param addon The addon's public listing.
 * @param channels The channel each addon type posts to.
 * @returns Its type's channel while listed, otherwise undefined: it has no message.
 */
export function desiredChannel(addon: PublicAddon, channels: AddonChannels): string | undefined {
	return addon.listed ? channels[addon.type] : undefined;
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
	messages: MessageGateway,
	channels: AddonChannels,
	listings: Map<string, APIMessage[]>,
	addons: PublicAddon[],
) {
	const posted = await db.select().from(addonMessage);
	const byUrl = new Map(addons.map((item) => [item.pageUrl, item]));
	const rows = new Map(posted.map((row) => [row.addonId, row]));
	const referenced = new Set(posted.map((row) => row.messageId));

	for (const [channelId, listing] of listings) {
		const listed = new Set(listing.map((message) => message.id));

		for (const message of listing) {
			const url = messageLinks(message).find((candidate) => byUrl.has(candidate));
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
					await messages.delete(channelId, message.id);

					continue;
				}

				if (row) {
					await messages.delete(row.channelId, row.messageId);
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

function authorIds(item: PublicAddon): string[] {
	return item.authors.flatMap((author) => (author.discordId ? [author.discordId] : []));
}

// The edit clears the embed and content, so an old embed post becomes a components v2 card in place;
// an edit Discord still rejects is answered by replacing the message.
async function editOrReplace(
	messages: MessageGateway,
	channelId: string,
	messageId: string,
	card: OutgoingMessage,
): Promise<string> {
	try {
		await messages.edit(channelId, messageId, card);

		return messageId;
	} catch (error) {
		if (discordFailure(error) !== 'rejected') {
			throw error;
		}

		logger.warn(`Failed to edit message ${messageId}, replacing it:`, error);
		await messages.delete(channelId, messageId);

		return messages.post(channelId, card);
	}
}

/**
 * @description Brings one addon's Discord message in line with its listing: posted, edited, moved or removed.
 * @param stores The bot database and the web's reads.
 * @param messages The bot's Discord messages.
 * @param id The addon id.
 * @param channels The channel each addon type posts to.
 * @param present Ids of our messages that exist, from a listing; without it the message is fetched.
 * @param emojis The author avatar emoji sync; without it a card shows no avatars.
 * @returns Resolves once the message and its row match the addon.
 */
export async function syncAddon(
	{ db, web }: Stores,
	messages: MessageGateway,
	id: string,
	channels: AddonChannels = ADDON_CHANNELS,
	present?: ReadonlySet<string>,
	emojis?: AuthorEmojis,
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
			await messages.delete(posted.channelId, posted.messageId);
			await db.delete(addonMessage).where(eq(addonMessage.addonId, id));
		}

		return;
	}

	const avatars = emojis ? await emojis.resolve(authorIds(current)) : new Map();
	const hash = contentHash(
		current,
		Object.fromEntries([...avatars].map(([discordId, emoji]) => [discordId, emoji.name])),
	);
	const kept =
		posted?.channelId === channelId &&
		(present?.has(posted.messageId) ??
			(await messages.exists(posted.channelId, posted.messageId)));

	if (posted && kept && posted.postedHash === hash) return;

	// Images are rendered only once the card is known to change; they need downloads.
	const card = renderAddon(current, await renderCardImages(current), avatars);

	if (posted && kept) {
		const messageId = await editOrReplace(messages, channelId, posted.messageId, card);

		await db
			.update(addonMessage)
			.set({ messageId, postedHash: hash, editedAt: new Date() })
			.where(eq(addonMessage.addonId, id));

		return;
	}

	if (posted) {
		await messages.delete(posted.channelId, posted.messageId);
	}

	const messageId = await messages.post(channelId, card);

	try {
		await storeMessage(db, id, channelId, messageId, hash);
	} catch (error) {
		// A post without its row would be duplicated by the next sync; reconcile adopts it if this fails.
		await messages.delete(channelId, messageId).catch((cleanup) => {
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
 * @param messages The bot's Discord messages.
 * @param channels The channel each addon type posts to.
 * @param emojis The author avatar emoji sync; its emojis of authors no posted addon names are deleted.
 * @returns Resolves once every addon was synced; one addon's failure is logged and left to the next run.
 */
export async function reconcileAddons(
	stores: Stores,
	messages: MessageGateway,
	channels: AddonChannels = ADDON_CHANNELS,
	emojis?: AuthorEmojis,
): Promise<void> {
	// One listing per channel replaces a fetch per message on every periodic run.
	const listings = new Map<string, APIMessage[]>();

	for (const channelId of new Set(Object.values(channels))) {
		if (channelId) {
			listings.set(channelId, await messages.listOwn(channelId));
		}
	}

	const present = new Set([...listings.values()].flat().map((message) => message.id));

	const addons = await stores.web.addons();

	await adoptOrphans(stores.db, messages, channels, listings, addons);

	const posted = await stores.db.select({ id: addonMessage.addonId }).from(addonMessage);
	const ids = new Set([...addons.map((item) => item.id), ...posted.map((row) => row.id)]);

	for (const id of ids) {
		try {
			await syncAddon(stores, messages, id, channels, present, emojis);
		} catch (error) {
			logger.error(`Failed to sync addon ${id}:`, error);
		}
	}

	const shown = addons.filter((item) => desiredChannel(item, channels));

	await emojis?.prune(new Set(shown.flatMap(authorIds)));
}

// One sync per process, so its avatar lookups and emoji listing outlive a single run.
let authorEmojis: AuthorEmojis | undefined;

function authorEmojisOf(client: Client<true>): AuthorEmojis {
	authorEmojis ??= createAuthorEmojis(client.rest, client.application.id);

	return authorEmojis;
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
	reconcile: (context) =>
		reconcileAddons(
			context,
			createMessageGateway(context.client.rest, context.client.user.id),
			ADDON_CHANNELS,
			authorEmojisOf(context.client),
		),
	/**
	 * @description Syncs the message of the addon a NOTIFY payload names.
	 * @param id The addon id from the payload.
	 * @param context The dispatcher's stores and Discord client.
	 * @returns Resolves once the addon's message matches its listing.
	 */
	handle: (id, context) =>
		syncAddon(
			context,
			createMessageGateway(context.client.rest, context.client.user.id),
			id,
			ADDON_CHANNELS,
			undefined,
			authorEmojisOf(context.client),
		),
};

export default {
	ADDON_CHANNELS,
	desiredChannel,
	syncAddon,
	reconcileAddons,
	addonsDispatcher,
};
