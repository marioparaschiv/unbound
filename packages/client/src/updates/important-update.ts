import { createLogger } from '@unbound-app/logger';

import { BUILD_CHANNEL, VERSION } from '~/core/constants';
import { readServerJson } from '~/core/server-data';
import { getBucket, persist } from '~/storage/api';

const logger = createLogger('Updater', 'Important');

/** Where every loader reads the published bundles from. */
export const PUBLISHED_MANIFEST_URL = 'https://builds.unbound.rip/manifest.json';

// The channel builds.unbound.rip publishes; dev, local and pull request builds prompt for every update.
// Typed `string`: `BUILD_CHANNEL` is a placeholder literal until the build stamps it.
const PUBLISHED_CHANNEL: string = 'beta';

// Device-local, as Sync would carry another device's bundle over.
const storage = getBucket('unbound::updater');

/** The part of the published manifest that decides whether a staged update prompts a restart. */
export type PublishedManifest = {
	/** When the newest build users should restart for was made. */
	importantAt?: string;
};

/**
 * @description Records when this device first ran this bundle's revision, the point later builds are measured from.
 */
export function recordRunningBundle() {
	if (storage.get('runningRevision', '') === VERSION) return;

	storage.set('runningRevision', VERSION);
	storage.set('runningSince', Date.now());
	// Saved now: an older iOS loader reloads settings.json at launch, dropping changes not yet saved.
	void persist();
}

/**
 * @description Reads whether a build users should restart for was made after this bundle started running.
 * @param manifest The published manifest.
 * @param runningSince When this device first ran its bundle, in milliseconds.
 * @returns Whether the manifest marks an important build after `runningSince`.
 */
export function isImportantSince(manifest: PublishedManifest, runningSince: number): boolean {
	const importantAt = manifest.importantAt ? Date.parse(manifest.importantAt) : Number.NaN;

	return Number.isFinite(importantAt) && importantAt > runningSince;
}

/**
 * @description Reads whether the staged update is worth a restart prompt. Published builds prompt only past an
 * important build; any other channel always prompts.
 * @param fetcher Fetches the published manifest.
 * @returns Whether to prompt; `false` when the manifest could not be read.
 */
export async function isStagedUpdateImportant(fetcher: typeof fetch = fetch): Promise<boolean> {
	if (BUILD_CHANNEL !== PUBLISHED_CHANNEL) return true;

	try {
		const response = await fetcher(PUBLISHED_MANIFEST_URL);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const manifest = readServerJson<PublishedManifest>(await response.text());

		return isImportantSince(manifest, storage.get('runningSince', Date.now()));
	} catch (error) {
		logger.error(`Failed to read the published manifest ${PUBLISHED_MANIFEST_URL}:`, error);

		return false;
	}
}
