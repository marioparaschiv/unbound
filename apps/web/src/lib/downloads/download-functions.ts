import { createServerFn } from '@tanstack/react-start';
import { createLogger } from '@unbound-app/logger';

import { EMPTY_DOWNLOADS, toDownloads, type Downloads } from '~/lib/downloads/builds';
import { createGitHubClient } from '~/lib/github';
import { getApp } from '~/lib/app';

const logger = createLogger('Web', 'Downloads');

/** The repository CI publishes loader releases to. */
export const UNBOUND_REPOSITORY = 'marioparaschiv/unbound';

// Every visitor shares one GitHub read: CI publishes a few times a day, so minutes of staleness cost nothing.
const FRESH_MS = 5 * 60_000;
// After a failed read, the last good builds stay up and GitHub is asked again a minute later.
const RETRY_MS = 60_000;

let cached: { downloads: Downloads; expiresAt: number } | undefined;
let pending: Promise<Downloads> | undefined;

async function refresh(): Promise<Downloads> {
	try {
		const releases = await createGitHubClient(getApp().env, null).listReleases(
			UNBOUND_REPOSITORY,
		);
		const downloads = toDownloads(releases);

		cached = { downloads, expiresAt: getApp().now().getTime() + FRESH_MS };

		return downloads;
	} catch (error) {
		logger.error(`Failed to list releases ${UNBOUND_REPOSITORY}:`, error);

		const downloads = cached?.downloads ?? EMPTY_DOWNLOADS;

		cached = { downloads, expiresAt: getApp().now().getTime() + RETRY_MS };

		return downloads;
	} finally {
		pending = undefined;
	}
}

/**
 * @description Loads the newest stable and nightly loader builds from GitHub releases, cached for minutes.
 * @returns Each channel's builds; empty when GitHub has never answered.
 */
export const fetchDownloads = createServerFn({ method: 'GET' }).handler((): Promise<Downloads> => {
	if (cached && cached.expiresAt > getApp().now().getTime()) {
		return Promise.resolve(cached.downloads);
	}

	pending ??= refresh();

	return pending;
});

export default { UNBOUND_REPOSITORY, fetchDownloads };
