import type { RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import type { BundleChannel } from '@unbound-app/contracts/loader';
import type { Bundle, BundleKey } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';
import { and, eq } from 'drizzle-orm';

import {
	createPostLedger,
	type AppendOnlyRows,
	type DesiredPost,
	type LedgerRow,
} from '~/lib/post-ledger';
import { renderReleaseMessage, REPOSITORY_URL } from '~/lib/release-message';
import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import type { MessageGateway } from '~/lib/discord-messages';
import type { CommitSubjects } from '~/lib/github-commits';
import type { Database } from '~/db/database';
import { bundlePost } from '~/db/schema';

export type BundlesOptions = {
	channelId: string;
	messages: MessageGateway;
	commits: CommitSubjects;
	/** The clock, in epoch milliseconds; a bundle older than a week is never announced. */
	now: () => number;
};

const logger = createLogger('Bot', 'Bundles');

const CHANNEL_NAMES: Record<BundleChannel, string> = { stable: 'Stable', beta: 'Beta' };
const BUNDLE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const COMMIT_SHA = /^[\da-f]{40}$/i;

function isChannel(value: string): value is BundleChannel {
	return Object.hasOwn(CHANNEL_NAMES, value);
}

function keyOf(bundle: BundleKey) {
	return `${bundle.channel}:${bundle.version}`;
}

function parseKey(payload: string): BundleKey | undefined {
	const separator = payload.indexOf(':');
	const channel = payload.slice(0, separator);

	if (separator < 0 || !isChannel(channel)) return;

	return { channel, version: payload.slice(separator + 1) };
}

function freshSince(now: number) {
	return new Date(now - BUNDLE_MAX_AGE_MS);
}

function shortVersion(version: string) {
	return COMMIT_SHA.test(version) ? version.slice(0, 7) : version;
}

function bundleTitle(bundle: BundleKey) {
	return `${CHANNEL_NAMES[bundle.channel]} bundle \`${shortVersion(bundle.version)}\``;
}

function changelogUrl(bundle: Bundle) {
	if (!bundle.previousVersion) {
		return `${REPOSITORY_URL}/commit/${bundle.version}`;
	}

	return `${REPOSITORY_URL}/compare/${shortVersion(bundle.previousVersion)}...${shortVersion(bundle.version)}`;
}

/**
 * @description Renders a compact bundle post that links to the commits since the channel's previous bundle.
 * @param bundle The bundle.
 * @param subject The subject of the commit it was built from, when GitHub gave one.
 * @returns The message body to post.
 */
export function renderBundle(bundle: Bundle, subject?: string): RESTPostAPIChannelMessageJSONBody {
	return renderReleaseMessage({
		title: bundleTitle(bundle),
		detail: subject ?? `${CHANNEL_NAMES[bundle.channel]} bundle`,
		changelogUrl: changelogUrl(bundle),
		publishedAt: bundle.publishedAt,
	});
}

function ledgerRow(row: typeof bundlePost.$inferSelect): LedgerRow {
	return { channelId: row.channelId, messageId: row.messageId ?? '', hash: '' };
}

function rowKey(row: typeof bundlePost.$inferSelect) {
	return keyOf({ channel: row.bundleChannel, version: row.version });
}

// The bundle_post table as an append-only ledger, keyed by `channel:version`; a floor row counts as posted.
const BUNDLE_ROWS: AppendOnlyRows = {
	async list(db) {
		const rows = await db.select().from(bundlePost);

		return new Map(rows.map((row) => [rowKey(row), ledgerRow(row)]));
	},
	async get(db, key) {
		const bundle = parseKey(key);

		if (!bundle) return;

		const [row] = await db
			.select()
			.from(bundlePost)
			.where(
				and(
					eq(bundlePost.bundleChannel, bundle.channel),
					eq(bundlePost.version, bundle.version),
				),
			);

		return row && ledgerRow(row);
	},
	async insert(db, key, { channelId, messageId }) {
		const bundle = parseKey(key);

		if (!bundle) return;

		await db
			.insert(bundlePost)
			// A floor row is written with an empty message id, which is stored as `null`.
			.values({
				bundleChannel: bundle.channel,
				version: bundle.version,
				channelId,
				messageId: messageId || null,
			})
			.onConflictDoNothing();
	},
};

async function hasFloor(db: Database) {
	const [row] = await db.select({ version: bundlePost.version }).from(bundlePost).limit(1);

	return Boolean(row);
}

/**
 * @description Creates the dispatcher that announces each fresh client bundle once, without pinging anyone.
 * @param options The channel, the bot's Discord messages, the commit subject reader and the clock.
 * @returns The `bundle_release` dispatcher.
 */
export function createBundlesDispatcher(options: BundlesOptions): Dispatcher {
	const { messages, commits, now, channelId } = options;
	const ledger = createPostLedger({
		messages,
		label: 'bundle',
		policy: 'append-only',
		rows: BUNDLE_ROWS,
	});

	function desiredPost(bundle: Bundle): DesiredPost {
		return {
			channelId,
			render: async () => ({ body: renderBundle(bundle, await commits(bundle.version)) }),
		};
	}

	// Announces the bundle a `channel:version` payload names; before the first reconcile lays the floor
	// it waits, so the first deploy never posts the bundles already out.
	async function announceBundle({ db, web }: DispatcherContext, payload: string) {
		const key = parseKey(payload);

		if (!key || !(await hasFloor(db))) return;

		const bundle = await web.bundle(key);

		if (!bundle || bundle.publishedAt < freshSince(now())) return;

		await ledger.sync(db, keyOf(key), desiredPost(bundle));
	}

	// The first run records every fresh bundle unposted; later runs adopt posts a crash left unrecorded,
	// then announce every unannounced fresh bundle in publish order.
	async function reconcileBundles({ db, web }: DispatcherContext) {
		const fresh = await web.bundlesSince(freshSince(now()));

		if (!(await hasFloor(db))) {
			// An empty floor still needs a row, or the next bundle would be taken for the first run's.
			const floor = fresh.length > 0 ? fresh : [{ channel: 'beta' as const, version: '' }];

			for (const bundle of floor) {
				await BUNDLE_ROWS.insert(db, keyOf(bundle), { channelId, messageId: '', hash: '' });
			}

			return;
		}

		const byTitle = new Map(fresh.map((bundle) => [bundleTitle(bundle), bundle]));

		await ledger.adopt(db, [channelId], (message) => {
			const title = message.embeds[0]?.title;
			const bundle = title ? byTitle.get(title) : undefined;

			return bundle && { key: keyOf(bundle), channelId };
		});

		for (const bundle of fresh) {
			try {
				await ledger.sync(db, keyOf(bundle), desiredPost(bundle));
			} catch (error) {
				logger.error(
					`Failed to announce bundle ${bundle.channel} ${bundle.version}:`,
					error,
				);
			}
		}
	}

	return {
		name: 'bundles',
		channel: 'bundle_release',
		reconcile: reconcileBundles,
		handle: (payload, context) => announceBundle(context, payload),
	};
}

export default { renderBundle, createBundlesDispatcher };
