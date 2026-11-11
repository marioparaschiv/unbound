import { createLogger } from '@unbound-app/logger';
import type { APIMessage } from 'discord.js';

import { discordFailure, type MessageGateway, type OutgoingMessage } from '~/lib/discord-messages';
import type { Database } from '~/db/database';

/** Where one subject's post is, and the content hash it was last written with. */
export type LedgerRow = { channelId: string; messageId: string; hash: string };

/** The table of a ledger whose posts never change once written. */
export type AppendOnlyRows = {
	list: (db: Database) => Promise<Map<string, LedgerRow>>;
	get: (db: Database, key: string) => Promise<LedgerRow | undefined>;
	/** Records a fresh post; for a mutable ledger it replaces the key's row. */
	insert: (db: Database, key: string, row: LedgerRow) => Promise<void>;
};

/** The table of a ledger whose posts follow their subject: edited, moved and removed. */
export type MutableRows = AppendOnlyRows & {
	/** Records an edit of the key's post in place. */
	update: (db: Database, key: string, row: LedgerRow) => Promise<void>;
	remove: (db: Database, key: string) => Promise<void>;
};

export type PostLedgerOptions = {
	messages: MessageGateway;
	/** Names a subject in logs, e.g. `addon`. */
	label: string;
} & (
	| { policy: 'mutable'; rows: MutableRows }
	/** A post is final once its row exists: it is never edited, deleted or reposted, even if gone. */
	| { policy: 'append-only'; rows: AppendOnlyRows }
);

/** The post a subject should have. */
export type DesiredPost = {
	channelId: string;
	/** The content's hash; a changed hash edits a mutable post. */
	hash?: string;
	/** Renders the content, called only once a post or edit is due. */
	render: () => Promise<OutgoingMessage>;
};

/** Which subject a listed post is of, and the channel that subject's post belongs in. */
export type Claimed = { key: string; channelId: string | undefined };

export type Adopted = {
	/** Ids of every listed post, to spare `sync` a fetch per message. */
	present: ReadonlySet<string>;
	/** Keys that have a row once adoption is done. */
	recorded: ReadonlySet<string>;
};

/** Keeps one Discord post per subject in step with a table of rows. */
export type PostLedger = {
	/**
	 * Lists our posts in the channels and adopts each a claim names but no row points at: a post whose
	 * row write was lost. A mutable ledger deletes the duplicates and stale posts it finds.
	 */
	adopt: (
		db: Database,
		channelIds: readonly string[],
		claim: (message: APIMessage) => Claimed | undefined,
	) => Promise<Adopted>;
	/** Brings the key's post in line with `desired`; `present` from `adopt` spares a fetch. */
	sync: (
		db: Database,
		key: string,
		desired: DesiredPost | undefined,
		present?: ReadonlySet<string>,
	) => Promise<void>;
};

const logger = createLogger('Bot', 'PostLedger');

/**
 * @description Creates a ledger of the bot's posts, one per subject key, over the given table.
 * @param options The bot's Discord messages, the log label, and the table with its policy.
 * @returns The ledger.
 */
export function createPostLedger(options: PostLedgerOptions): PostLedger {
	const { messages, label } = options;

	// The edit clears the embed and content, so an old embed post becomes a components v2 card in
	// place; an edit Discord still rejects is answered by replacing the message.
	async function editOrReplace(channelId: string, messageId: string, message: OutgoingMessage) {
		try {
			await messages.edit(channelId, messageId, message);

			return messageId;
		} catch (error) {
			if (discordFailure(error) !== 'rejected') {
				throw error;
			}

			logger.warn(`Failed to edit message ${messageId}, replacing it:`, error);
			await messages.delete(channelId, messageId);

			return messages.post(channelId, message);
		}
	}

	async function adoptOne(
		db: Database,
		rows: Map<string, LedgerRow>,
		listed: ReadonlySet<string>,
		message: APIMessage,
		channelId: string,
		claimed: Claimed,
	) {
		const row = rows.get(claimed.key);

		if (options.policy === 'append-only') {
			if (row || claimed.channelId !== channelId) return;

			const adopted = { channelId, messageId: message.id, hash: '' };

			await options.rows.insert(db, claimed.key, adopted);
			rows.set(claimed.key, adopted);

			return;
		}

		const kept = row?.channelId === channelId && listed.has(row.messageId);

		// A row whose message is gone takes this post over instead of deleting it and posting anew.
		if (claimed.channelId !== channelId || kept) {
			await messages.delete(channelId, message.id);

			return;
		}

		if (row) {
			await messages.delete(row.channelId, row.messageId);
		}

		// An empty hash makes the following sync edit the message to the current content.
		const adopted = { channelId, messageId: message.id, hash: '' };

		await options.rows.insert(db, claimed.key, adopted);
		rows.set(claimed.key, adopted);
	}

	async function adopt(
		db: Database,
		channelIds: readonly string[],
		claim: (message: APIMessage) => Claimed | undefined,
	): Promise<Adopted> {
		// One listing per channel replaces a fetch per message on every periodic run.
		const listings = new Map<string, APIMessage[]>();

		for (const channelId of new Set(channelIds)) {
			listings.set(channelId, await messages.listOwn(channelId));
		}

		const rows = await options.rows.list(db);
		const referenced = new Set([...rows.values()].map((row) => row.messageId));

		for (const [channelId, listing] of listings) {
			const listed = new Set(listing.map((message) => message.id));

			for (const message of listing) {
				const claimed = claim(message);

				// A post no claim names is not a subject's post (a tag reply, an old bot's post), so it stays.
				if (!claimed || referenced.has(message.id)) {
					continue;
				}

				try {
					await adoptOne(db, rows, listed, message, channelId, claimed);
				} catch (error) {
					// An append-only post left unrecorded would be posted again, so the run stops here.
					if (options.policy === 'append-only') {
						throw error;
					}

					logger.error(
						`Failed to adopt message ${message.id} of ${label} ${claimed.key}:`,
						error,
					);
				}
			}
		}

		return {
			present: new Set([...listings.values()].flat().map((message) => message.id)),
			recorded: new Set(rows.keys()),
		};
	}

	async function post(db: Database, key: string, desired: DesiredPost) {
		const { channelId } = desired;
		const messageId = await messages.post(channelId, await desired.render());
		const row = { channelId, messageId, hash: desired.hash ?? '' };

		// An append-only post is final, so a failed row write leaves it for adoption, never deletes it.
		if (options.policy === 'append-only') {
			await options.rows.insert(db, key, row);

			return;
		}

		try {
			await options.rows.insert(db, key, row);
		} catch (error) {
			// A post without its row would be duplicated by the next sync; reconcile adopts it if this fails.
			await messages.delete(channelId, messageId).catch((cleanup) => {
				logger.warn(
					`Failed to remove unrecorded message ${messageId} of ${label} ${key}:`,
					cleanup,
				);
			});

			throw error;
		}
	}

	async function sync(
		db: Database,
		key: string,
		desired: DesiredPost | undefined,
		present?: ReadonlySet<string>,
	) {
		const row = await options.rows.get(db, key);

		if (options.policy === 'append-only') {
			if (!row && desired) {
				await post(db, key, desired);
			}

			return;
		}

		// An undesired post goes, and a desired one later is posted afresh. Discord goes first, so a
		// crash in between leaves a row whose message is already gone, which the next sync clears.
		if (!desired) {
			if (row) {
				await messages.delete(row.channelId, row.messageId);
				await options.rows.remove(db, key);
			}

			return;
		}

		const kept =
			row?.channelId === desired.channelId &&
			(present?.has(row.messageId) ?? (await messages.exists(row.channelId, row.messageId)));

		if (row && kept && row.hash === desired.hash) return;

		if (row && kept) {
			const messageId = await editOrReplace(
				desired.channelId,
				row.messageId,
				await desired.render(),
			);

			await options.rows.update(db, key, {
				channelId: desired.channelId,
				messageId,
				hash: desired.hash ?? '',
			});

			return;
		}

		if (row) {
			await messages.delete(row.channelId, row.messageId);
		}

		await post(db, key, desired);
	}

	return { adopt, sync };
}

export default { createPostLedger };
