import type { SettingsValue } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';

import { NativePlatform } from '~/native/native';
import { getBucket } from '~/storage/api';

const Logger = createLogger('Metro', 'Cache');

/** The metro cache's own file in the Unbound folder. Kept out of settings.json, it never loads with settings or syncs. */
const CACHE_FILE = 'metro-cache.json';

/** Where the metro cache lived before it had a file, and still lives under a loader that cannot read files. */
const LEGACY_BUCKET = 'unbound::cache';

/** The metro cache's saved fields, as read back: any field may be missing, or any JSON value a hand edit left. */
export type StoredCache = Record<string, SettingsValue | undefined>;

type CacheFile = {
	read: (path: string) => string | undefined;
	write: (path: string, text: string) => boolean;
};

// The loader's file reads and writes; `undefined` under a loader too old to have them.
function cacheFile(): CacheFile | undefined {
	const files = NativePlatform?.files;

	if (typeof files?.read !== 'function' || typeof files.write !== 'function') {
		return undefined;
	}

	return {
		read: (path) => files.read?.(path),
		write: (path, text) => files.write?.(path, text) ?? false,
	};
}

// Set when this launch read the cache from the Bucket though it has a file, so the first save empties the Bucket.
let migrating = false;

function isRecord(value: unknown): value is StoredCache {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readLegacy(fields: readonly string[]): StoredCache {
	const bucket = getBucket(LEGACY_BUCKET);
	const stored: StoredCache = {};

	for (const field of fields) {
		stored[field] = bucket.get<SettingsValue | undefined>(field, undefined);
	}

	return stored;
}

/**
 * @description Reads the saved metro cache, from its file, or once from the settings Bucket it moved out of.
 * @param fields The cache's fields, read one by one from the Bucket.
 * @returns The saved fields; empty when nothing was saved or the file is unreadable.
 */
export function readStoredCache(fields: readonly string[]): StoredCache {
	const file = cacheFile();

	if (!file) {
		return readLegacy(fields);
	}

	const text = file.read(CACHE_FILE);

	if (text === undefined) {
		// First launch since the move: carry the Bucket over; the first save writes the file and clears it.
		migrating = true;

		return readLegacy(fields);
	}

	try {
		const value: unknown = JSON.parse(text);

		return isRecord(value) ? value : {};
	} catch (error) {
		Logger.error(`Failed to parse metro cache ${CACHE_FILE}:`, error);

		return {};
	}
}

/**
 * @description Saves the metro cache: the whole of it to its file, or the changed fields to the settings Bucket.
 * @param state The whole cache.
 * @param fields The fields that changed since the last save.
 */
export function writeStoredCache(state: Record<string, SettingsValue>, fields: Iterable<string>) {
	const file = cacheFile();

	if (!file) {
		const bucket = getBucket(LEGACY_BUCKET);

		for (const field of fields) {
			bucket.set(field, state[field]);
		}

		return;
	}

	if (!file.write(CACHE_FILE, JSON.stringify(state))) {
		Logger.error(`Failed to write metro cache ${CACHE_FILE}.`);

		return;
	}

	if (!migrating) {
		return;
	}

	migrating = false;
	getBucket(LEGACY_BUCKET).clear();
}
