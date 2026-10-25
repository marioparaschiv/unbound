import type { BotRelease } from '@unbound-app/contracts/bot';
import { inArray, sql } from 'drizzle-orm';

import type { ChangeFeed, FeedChange } from '~/lib/bot/feed';
import { toLoaderRelease } from '~/lib/loader-releases';
import type { AppContext } from '~/lib/context';
import { loaderRelease } from '~/db/schema';

// Matches the key the `bot_feed_release_*` triggers write.
const RELEASE_KEY = sql<string>`${loaderRelease.platform} || ':' || ${loaderRelease.version}`;

async function hydrateReleases(
	ctx: AppContext,
	changes: FeedChange[],
): Promise<Map<string, BotRelease>> {
	const rows = ctx.db
		.select({ key: RELEASE_KEY, release: loaderRelease })
		.from(loaderRelease)
		.where(
			inArray(
				RELEASE_KEY,
				changes.map((change) => change.key),
			),
		)
		.all();

	return new Map(rows.map((row) => [row.key, toLoaderRelease(row.release)]));
}

/** Every published or republished loader release; a withdrawn one has nothing to show and is skipped. */
export const releasesFeed: ChangeFeed<BotRelease> = { name: 'releases', hydrate: hydrateReleases };

export default { releasesFeed };
