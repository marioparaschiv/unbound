import type { LoaderPlatform } from '@unbound-app/contracts/loader';
import type { RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import type { Release, ReleaseKey } from '@unbound-app/web/bot';
import { ButtonStyle, ComponentType } from 'discord.js';
import { createLogger } from '@unbound-app/logger';
import { and, eq } from 'drizzle-orm';

import {
	createPostLedger,
	type AppendOnlyRows,
	type DesiredPost,
	type LedgerRow,
} from '~/lib/post-ledger';
import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import type { MessageGateway } from '~/lib/discord-messages';
import { releasePost } from '~/db/schema';
import { COLOURS } from '~/lib/constants';

export type ReleaseTarget = {
	channelId: string;
	roleId: string;
};

export type ReleasesOptions = ReleaseTarget & {
	messages: MessageGateway;
	/** The clock, in epoch milliseconds; a release older than a week is never announced. */
	now: () => number;
};

const logger = createLogger('Bot', 'Releases');

const PLATFORM_NAMES: Record<LoaderPlatform, string> = { ios: 'iOS', android: 'Android' };
// An older release is never announced, or a first deploy would ping the role once per historic release.
const RELEASE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isPlatform(value: string): value is LoaderPlatform {
	return Object.hasOwn(PLATFORM_NAMES, value);
}

function keyOf(release: ReleaseKey) {
	return `${release.platform}:${release.version}`;
}

function parseKey(payload: string): ReleaseKey | undefined {
	const separator = payload.indexOf(':');
	const platform = payload.slice(0, separator);

	if (separator < 0 || !isPlatform(platform)) return;

	return { platform, version: payload.slice(separator + 1) };
}

function freshSince(now: number) {
	return new Date(now - RELEASE_MAX_AGE_MS);
}

function releaseTitle(release: ReleaseKey) {
	return `Unbound for ${PLATFORM_NAMES[release.platform]} ${release.version}`;
}

/**
 * @description Renders a compact loader release announcement that links out to the changelog and pings only the releases role.
 * @param release The release.
 * @param roleId The role to ping.
 * @returns The message body to post.
 */
export function renderRelease(release: Release, roleId: string): RESTPostAPIChannelMessageJSONBody {
	return {
		content: `<@&${roleId}>`,
		embeds: [
			{
				title: releaseTitle(release),
				url: release.url,
				color: COLOURS.brand,
				timestamp: release.publishedAt.toISOString(),
			},
		],
		components: [
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.Button,
						style: ButtonStyle.Link,
						label: 'View changelog',
						url: release.url,
					},
				],
			},
		],
		allowed_mentions: { parse: [], roles: [roleId] },
	};
}

function ledgerRow(row: typeof releasePost.$inferSelect): LedgerRow {
	return { channelId: row.channelId, messageId: row.messageId, hash: '' };
}

// The release_post table as an append-only ledger, keyed by `platform:version`.
const RELEASE_ROWS: AppendOnlyRows = {
	async list(db) {
		const rows = await db.select().from(releasePost);

		return new Map(rows.map((row) => [keyOf(row), ledgerRow(row)]));
	},
	async get(db, key) {
		const release = parseKey(key);

		if (!release) return;

		const [row] = await db
			.select()
			.from(releasePost)
			.where(
				and(
					eq(releasePost.platform, release.platform),
					eq(releasePost.version, release.version),
				),
			);

		return row && ledgerRow(row);
	},
	async insert(db, key, { channelId, messageId }) {
		const release = parseKey(key);

		if (!release) return;

		await db
			.insert(releasePost)
			.values({ ...release, channelId, messageId })
			.onConflictDoNothing();
	},
};

/**
 * @description Creates the dispatcher that announces each fresh loader release once, pinging the releases role.
 * @param options The channel and role, the bot's Discord messages and the clock.
 * @returns The `loader_release` dispatcher.
 */
export function createReleasesDispatcher(options: ReleasesOptions): Dispatcher {
	const { messages, now, channelId, roleId } = options;
	// Once posted, a release is never edited or reposted, even if its message was deleted by hand:
	// a repost would ping the role a second time.
	const ledger = createPostLedger({
		messages,
		label: 'release',
		policy: 'append-only',
		rows: RELEASE_ROWS,
	});

	function desiredPost(release: Release): DesiredPost {
		return { channelId, render: async () => ({ body: renderRelease(release, roleId) }) };
	}

	// Announces the release a `platform:version` payload names unless it was announced already.
	async function announceRelease({ db, web }: DispatcherContext, payload: string) {
		const key = parseKey(payload);

		if (!key) return;

		const release = await web.release(key);

		if (!release || release.publishedAt < freshSince(now())) return;

		await ledger.sync(db, keyOf(key), desiredPost(release));
	}

	// Adopts announcements a crash left unrecorded, then announces every unannounced fresh release in
	// publish order; one release's failure is logged and left to the next run.
	async function reconcileReleases({ db, web }: DispatcherContext) {
		const fresh = await web.releasesSince(freshSince(now()));
		const byTitle = new Map(fresh.map((release) => [releaseTitle(release), release]));

		// Our announcement whose title names a fresh release is that release's post.
		await ledger.adopt(db, [channelId], (message) => {
			const title = message.embeds[0]?.title;
			const release = title ? byTitle.get(title) : undefined;

			return release && { key: keyOf(release), channelId };
		});

		for (const release of fresh) {
			try {
				await ledger.sync(db, keyOf(release), desiredPost(release));
			} catch (error) {
				logger.error(`Failed to announce ${release.platform} ${release.version}:`, error);
			}
		}
	}

	return {
		name: 'releases',
		channel: 'loader_release',
		reconcile: reconcileReleases,
		handle: (payload, context) => announceRelease(context, payload),
	};
}

export default { renderRelease, createReleasesDispatcher };
