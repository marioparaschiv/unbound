import {
	docsManifestSchema,
	getDocsManifestKey,
	MAIN_DOCS_VERSION,
} from '@unbound-app/contracts/docs';
import type { RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import { safeParse } from '@unbound-app/contracts/schema';
import { createLogger } from '@unbound-app/logger';
import { eq } from 'drizzle-orm';

import {
	createPostLedger,
	type AppendOnlyRows,
	type DesiredPost,
	type LedgerRow,
} from '~/lib/post-ledger';
import { renderReleaseMessage, REPOSITORY_URL } from '~/lib/release-message';
import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import type { MessageGateway } from '~/lib/discord-messages';
import type { Fetch } from '~/lib/github-contributors';
import { apiReleasePost } from '~/db/schema';

export type ApiReleasesOptions = {
	channelId: string;
	/** The CDN the site reads its docs from; a version is out once its docs are listed there. */
	cdnUrl: string;
	messages: MessageGateway;
	/** The clock, in epoch milliseconds; a post's timestamp is when the feed found the release. */
	now: () => number;
	fetch?: Fetch;
};

const logger = createLogger('Bot', 'ApiReleases');

function releaseTitle(version: string) {
	return `@unbound-app/api ${version}`;
}

/**
 * @description Renders a compact `@unbound-app/api` release post that links to its GitHub release notes.
 * @param version The released version, without the docs' `v` prefix.
 * @param foundAt When the feed found it listed on the site.
 * @returns The message body to post.
 */
export function renderApiRelease(
	version: string,
	foundAt: Date,
): RESTPostAPIChannelMessageJSONBody {
	return renderReleaseMessage({
		title: releaseTitle(version),
		detail: 'API',
		changelogUrl: `${REPOSITORY_URL}/releases/tag/api-v${version}`,
		publishedAt: foundAt,
	});
}

function ledgerRow(row: typeof apiReleasePost.$inferSelect): LedgerRow {
	return { channelId: row.channelId, messageId: row.messageId ?? '', hash: '' };
}

// The api_release_post table as an append-only ledger, keyed by version; a floor row counts as posted.
const API_RELEASE_ROWS: AppendOnlyRows = {
	async list(db) {
		const rows = await db.select().from(apiReleasePost);

		return new Map(rows.map((row) => [row.version, ledgerRow(row)]));
	},
	async get(db, version) {
		const [row] = await db
			.select()
			.from(apiReleasePost)
			.where(eq(apiReleasePost.version, version));

		return row && ledgerRow(row);
	},
	async insert(db, version, { channelId, messageId }) {
		await db
			.insert(apiReleasePost)
			// A floor row is written with an empty message id, which is stored as `null`.
			.values({ version, channelId, messageId: messageId || null })
			.onConflictDoNothing();
	},
};

/**
 * @description Creates the dispatcher that announces each `@unbound-app/api` release once its docs are on the site.
 * The docs live on the CDN, not in the web's tables, so it has no NOTIFY channel and runs on the timer alone.
 * @param options The channel, the CDN, the bot's Discord messages, the clock and the fetch to use.
 * @returns The `api-releases` dispatcher.
 */
export function createApiReleasesDispatcher(options: ApiReleasesOptions): Dispatcher {
	const { channelId, cdnUrl, messages, now, fetch = globalThis.fetch } = options;
	const manifestUrl = `${cdnUrl}/${getDocsManifestKey('api')}`;
	const ledger = createPostLedger({
		messages,
		label: 'api release',
		policy: 'append-only',
		rows: API_RELEASE_ROWS,
	});

	function desiredPost(version: string): DesiredPost {
		return {
			channelId,
			render: async () => ({ body: renderApiRelease(version, new Date(now())) }),
		};
	}

	// The released versions the site lists, oldest first, without the `v` prefix.
	async function listedVersions(): Promise<string[]> {
		const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(30_000) });

		if (response.status === 404) {
			return [];
		}

		if (!response.ok) {
			throw new Error(`Failed to read the API docs manifest: ${response.status}.`);
		}

		const parsed = safeParse(docsManifestSchema, await response.json());

		if (!parsed.success) {
			throw new Error('Failed to read the API docs manifest: it does not match its schema.');
		}

		return parsed.data.versions
			.filter((version) => version !== MAIN_DOCS_VERSION)
			.map((version) => version.slice(1))
			.toReversed();
	}

	// The first run records every listed version unposted; later runs adopt posts a crash left
	// unrecorded, then announce every unannounced version, oldest first.
	async function reconcileReleases({ db }: DispatcherContext) {
		const versions = await listedVersions();
		const recorded = await API_RELEASE_ROWS.list(db);

		if (recorded.size === 0) {
			// An empty floor still needs a row, or the next version would be taken for the first run's.
			for (const version of versions.length > 0 ? versions : ['']) {
				await API_RELEASE_ROWS.insert(db, version, { channelId, messageId: '', hash: '' });
			}

			return;
		}

		const byTitle = new Map(versions.map((version) => [releaseTitle(version), version]));

		await ledger.adopt(db, [channelId], (message) => {
			const title = message.embeds[0]?.title;
			const version = title ? byTitle.get(title) : undefined;

			return version === undefined ? undefined : { key: version, channelId };
		});

		for (const version of versions) {
			try {
				await ledger.sync(db, version, desiredPost(version));
			} catch (error) {
				logger.error(`Failed to announce API release ${version}:`, error);
			}
		}
	}

	return {
		name: 'api-releases',
		reconcile: reconcileReleases,
		// No table wakes it, so nothing ever calls this.
		handle: async () => void 0,
	};
}

export default { renderApiRelease, createApiReleasesDispatcher };
