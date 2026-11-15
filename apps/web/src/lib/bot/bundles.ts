import { and, asc, eq, gte, sql } from 'drizzle-orm';

import type { Bundle, BundleKey } from '~/lib/bot/types';
import type { ReadDatabase } from '~/lib/bot/reads';
import { bundleRelease } from '~/db/schema';

// Each bundle with the version published before it on its channel, which its changelog compares against.
function withPrevious(db: ReadDatabase) {
	return db.$with('ranked').as(
		db
			.select({
				channel: bundleRelease.channel,
				version: bundleRelease.version,
				previousVersion: sql<
					string | null
				>`lag(${bundleRelease.version}) over (partition by ${bundleRelease.channel} order by ${bundleRelease.publishedAt}, ${bundleRelease.version})`.as(
					'previous_version',
				),
				publishedAt: bundleRelease.publishedAt,
			})
			.from(bundleRelease),
	);
}

/**
 * @description Reads one published client bundle.
 * @param db The read database.
 * @param key The bundle's channel and version.
 * @returns The bundle, or `undefined` when it was never published.
 */
export async function readBundle(db: ReadDatabase, key: BundleKey): Promise<Bundle | undefined> {
	const ranked = withPrevious(db);
	const [row] = await db
		.with(ranked)
		.select()
		.from(ranked)
		.where(and(eq(ranked.channel, key.channel), eq(ranked.version, key.version)));

	return row;
}

/**
 * @description Reads the client bundles published at or after a moment.
 * @param db The read database.
 * @param since The earliest publish time.
 * @returns The bundles in publish order, ties by channel then version.
 */
export function readBundlesSince(db: ReadDatabase, since: Date): Promise<Bundle[]> {
	const ranked = withPrevious(db);

	return db
		.with(ranked)
		.select()
		.from(ranked)
		.where(gte(ranked.publishedAt, since))
		.orderBy(asc(ranked.publishedAt), asc(ranked.channel), asc(ranked.version));
}

export default { readBundle, readBundlesSince };
