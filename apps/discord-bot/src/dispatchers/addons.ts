import type { AddonType } from '@unbound-app/contracts/addons';
import type { PublicAddon } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';
import type { APIMessage } from 'discord.js';
import { eq } from 'drizzle-orm';

import { discordFailure, type MessageGateway, type OutgoingMessage } from '~/lib/discord-messages';
import { messageLinks, renderAddon, renderCardImages } from '~/dispatchers/addon-card';
import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import type { AuthorEmojis } from '~/lib/author-emojis';
import { contentHash } from '~/lib/content-hash';
import type { DiscordIds } from '~/lib/config';
import type { Database } from '~/db/database';
import { addonMessage } from '~/db/schema';

export type AddonChannels = { [K in AddonType]?: string };

export type AddonsOptions = {
	/** The channel each addon type posts to. */
	channels: AddonChannels;
	messages: MessageGateway;
	/** The author avatar emoji sync, one per process so its lookups outlive a single run. */
	emojis: AuthorEmojis;
};

const logger = createLogger('Bot', 'Addons');

/**
 * @description Names the channel each addon type posts to; fonts have none, so they are never posted.
 * @param ids The id constants.
 * @returns The channels, an unset id leaving its type out.
 */
export function addonChannels(
	ids: Pick<DiscordIds, 'PLUGINS_CHANNEL_ID' | 'THEMES_CHANNEL_ID' | 'ICON_PACKS_CHANNEL_ID'>,
): AddonChannels {
	return {
		plugin: ids.PLUGINS_CHANNEL_ID,
		theme: ids.THEMES_CHANNEL_ID,
		'icon-pack': ids.ICON_PACKS_CHANNEL_ID,
	};
}

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
 * @description Creates the dispatcher that keeps one card per listed addon in its type's channel.
 * @param options The channels, the bot's Discord messages and the author avatar emoji sync.
 * @returns The `addon_changed` dispatcher.
 */
export function createAddonsDispatcher({ channels, messages, emojis }: AddonsOptions): Dispatcher {
	// Brings one addon's message in line with its listing: posted, edited, moved or removed. `present`
	// holds our message ids from a listing; without it the message is fetched.
	async function sync({ db, web }: DispatcherContext, id: string, present?: ReadonlySet<string>) {
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

		const avatars = await emojis.resolve(authorIds(current));
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

	// Adopts messages a crash left without a row, then syncs every addon that has or had a message;
	// one addon's failure is logged and left to the next run.
	async function reconcile(context: DispatcherContext) {
		// One listing per channel replaces a fetch per message on every periodic run.
		const listings = new Map<string, APIMessage[]>();

		for (const channelId of new Set(Object.values(channels))) {
			if (channelId) {
				listings.set(channelId, await messages.listOwn(channelId));
			}
		}

		const present = new Set([...listings.values()].flat().map((message) => message.id));

		const addons = await context.web.addons();

		await adoptOrphans(context.db, messages, channels, listings, addons);

		const posted = await context.db.select({ id: addonMessage.addonId }).from(addonMessage);
		const ids = new Set([...addons.map((item) => item.id), ...posted.map((row) => row.id)]);

		for (const id of ids) {
			try {
				await sync(context, id, present);
			} catch (error) {
				logger.error(`Failed to sync addon ${id}:`, error);
			}
		}

		const shown = addons.filter((item) => desiredChannel(item, channels));

		// Its emojis of authors no posted addon names are deleted.
		await emojis.prune(new Set(shown.flatMap(authorIds)));
	}

	return {
		name: 'addons',
		channel: 'addon_changed',
		reconcile,
		// The payload is the addon id.
		handle: (id, context) => sync(context, id),
	};
}

export default { addonChannels, desiredChannel, createAddonsDispatcher };
