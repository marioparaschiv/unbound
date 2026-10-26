import { and, asc, eq, gte } from 'drizzle-orm';

import type { Release, ReleaseKey } from '~/lib/bot/types';
import type { ReadDatabase } from '~/lib/bot/reads';
import { loaderRelease } from '~/db/schema';

const RELEASE_COLUMNS = {
	platform: loaderRelease.platform,
	version: loaderRelease.version,
	url: loaderRelease.url,
	changelog: loaderRelease.changelog,
	publishedAt: loaderRelease.publishedAt,
};

/**
 * @description Reads one published loader release.
 * @param db The read database.
 * @param key The release's platform and version.
 * @returns The release, or `undefined` when it was never published or was withdrawn.
 */
export async function readRelease(db: ReadDatabase, key: ReleaseKey): Promise<Release | undefined> {
	const [row] = await db
		.select(RELEASE_COLUMNS)
		.from(loaderRelease)
		.where(
			and(eq(loaderRelease.platform, key.platform), eq(loaderRelease.version, key.version)),
		);

	return row;
}

/**
 * @description Reads the loader releases published at or after a moment.
 * @param db The read database.
 * @param since The earliest publish time.
 * @returns The releases in publish order, ties by platform then version.
 */
export function readReleasesSince(db: ReadDatabase, since: Date): Promise<Release[]> {
	return db
		.select(RELEASE_COLUMNS)
		.from(loaderRelease)
		.where(gte(loaderRelease.publishedAt, since))
		.orderBy(
			asc(loaderRelease.publishedAt),
			asc(loaderRelease.platform),
			asc(loaderRelease.version),
		);
}

export default { readRelease, readReleasesSince };
