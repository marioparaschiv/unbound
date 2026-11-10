import type { AddonType } from '@unbound-app/contracts/addons';
import type { PublicAddon } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';
import { eq } from 'drizzle-orm';

import {
	createPostLedger,
	type DesiredPost,
	type LedgerRow,
	type MutableRows,
} from '~/lib/post-ledger';
import { messageLinks, renderAddon, renderCardImages } from '~/dispatchers/addon-card';
import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import type { MessageGateway } from '~/lib/discord-messages';
import type { AuthorEmojis } from '~/lib/author-emojis';
import { contentHash } from '~/lib/content-hash';
import type { DiscordIds } from '~/lib/config';
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

// The addon_message table as a mutable ledger, keyed by addon id.
const ADDON_ROWS: MutableRows = {
	async list(db) {
		const rows = await db.select().from(addonMessage);

		return new Map(rows.map((row) => [row.addonId, ledgerRow(row)]));
	},
	async get(db, addonId) {
		const [row] = await db.select().from(addonMessage).where(eq(addonMessage.addonId, addonId));

		return row && ledgerRow(row);
	},
	async insert(db, addonId, { channelId, messageId, hash }) {
		const values = {
			channelId,
			messageId,
			postedHash: hash,
			postedAt: new Date(),
			editedAt: null,
		};

		await db
			.insert(addonMessage)
			.values({ addonId, ...values })
			.onConflictDoUpdate({ target: addonMessage.addonId, set: values });
	},
	async update(db, addonId, { channelId, messageId, hash }) {
		await db
			.update(addonMessage)
			.set({ channelId, messageId, postedHash: hash, editedAt: new Date() })
			.where(eq(addonMessage.addonId, addonId));
	},
	async remove(db, addonId) {
		await db.delete(addonMessage).where(eq(addonMessage.addonId, addonId));
	},
};

function ledgerRow(row: typeof addonMessage.$inferSelect): LedgerRow {
	return { channelId: row.channelId, messageId: row.messageId, hash: row.postedHash };
}

function authorIds(item: PublicAddon): string[] {
	return item.authors.flatMap((author) => (author.discordId ? [author.discordId] : []));
}

/**
 * @description Creates the dispatcher that keeps one card per listed addon in its type's channel.
 * @param options The channels, the bot's Discord messages and the author avatar emoji sync.
 * @returns The `addon_changed` dispatcher.
 */
export function createAddonsDispatcher({ channels, messages, emojis }: AddonsOptions): Dispatcher {
	const ledger = createPostLedger({
		messages,
		label: 'addon',
		policy: 'mutable',
		rows: ADDON_ROWS,
	});

	// The post an addon should have: none while it is unknown or delisted, else its card.
	async function desiredPost(addon: PublicAddon | undefined): Promise<DesiredPost | undefined> {
		const channelId = addon ? desiredChannel(addon, channels) : undefined;

		if (!addon || !channelId) return;

		const avatars = await emojis.resolve(authorIds(addon));

		return {
			channelId,
			hash: contentHash(
				addon,
				Object.fromEntries(
					[...avatars].map(([discordId, emoji]) => [discordId, emoji.name]),
				),
			),
			// Images are rendered only once the card is known to change; they need downloads.
			render: async () => renderAddon(addon, await renderCardImages(addon), avatars),
		};
	}

	// Brings one addon's message in line with its listing. `present` holds our message ids from a
	// listing; without it the message is fetched.
	async function sync({ db, web }: DispatcherContext, id: string, present?: ReadonlySet<string>) {
		await ledger.sync(db, id, await desiredPost(await web.addon(id)), present);
	}

	// Adopts messages a crash left without a row, then syncs every addon that has or had a message;
	// one addon's failure is logged and left to the next run.
	async function reconcile(context: DispatcherContext) {
		const addons = await context.web.addons();
		const byUrl = new Map(addons.map((item) => [item.pageUrl, item]));
		const { present, recorded } = await ledger.adopt(
			context.db,
			Object.values(channels).filter((channelId) => channelId !== undefined),
			(message) => {
				const url = messageLinks(message).find((candidate) => byUrl.has(candidate));
				const owner = url ? byUrl.get(url) : undefined;

				return owner && { key: owner.id, channelId: desiredChannel(owner, channels) };
			},
		);
		const ids = new Set([...addons.map((item) => item.id), ...recorded]);

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
