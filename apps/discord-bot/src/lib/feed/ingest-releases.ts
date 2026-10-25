import { anyDistinct, fromExcluded } from '~/db/excluded';
import type { ReleaseFeedItem } from '~/lib/feed/types';
import type { Transaction } from '~/db/database';
import { loaderRelease } from '~/db/schema';
import dedupe from '~/lib/feed/dedupe';

/**
 * @description Upserts loader releases, leaving the posted message ids alone.
 * @param tx The page's transaction.
 * @param items The page's release items.
 * @returns Resolves once the page is written.
 */
export async function ingestReleases(tx: Transaction, items: ReleaseFeedItem[]): Promise<void> {
	if (!items.length) return;

	const rows = dedupe(items, (item) => `${item.platform}:${item.version}`).map((item) => ({
		platform: item.platform,
		version: item.version,
		url: item.url,
		changelog: item.changelog,
		publishedAt: new Date(item.publishedAt),
	}));
	const columns = {
		url: loaderRelease.url,
		changelog: loaderRelease.changelog,
		publishedAt: loaderRelease.publishedAt,
	};

	await tx
		.insert(loaderRelease)
		.values(rows)
		.onConflictDoUpdate({
			target: [loaderRelease.platform, loaderRelease.version],
			set: fromExcluded(columns),
			setWhere: anyDistinct(Object.values(columns)),
		});
}

export default { ingestReleases };
