import type { SettingsValue } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';

import { NativePlatform } from '~/native/native';
import { benchSpan } from '~/core/bench-span';
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

	const text = benchSpan('metro cache file read', () => file.read(CACHE_FILE));

	if (text === undefined) {
		// First launch since the move: carry the Bucket over; the first save writes the file and clears it.
		migrating = true;

		return readLegacy(fields);
	}

	try {
		const value: unknown = benchSpan(
			() => `metro cache parse ${Math.round(text.length / 1024)} KB`,
			() => JSON.parse(text),
		);

		return isRecord(value) ? value : {};
	} catch (error) {
		Logger.error(`Failed to parse metro cache ${CACHE_FILE}:`, error);

		return {};
	}
}

// A detached field's own file, beside the cache's.
const detachedFile = (field: string) => CACHE_FILE.replace(/\.json$/, `.${field}.json`);

/**
 * @description Reads one field the cache keeps in its own file, so launches that never need it skip parsing it.
 * @param field The detached field.
 * @returns The field's saved value, or `undefined` when nothing was saved or the file is unreadable.
 */
export function readStoredField(field: string): SettingsValue | undefined {
	const file = cacheFile();
	const text = file?.read(detachedFile(field));

	if (!file || (text === undefined && migrating)) {
		return readLegacy([field])[field];
	}

	if (text === undefined) return;

	try {
		return benchSpan(`metro cache parse ${field}`, () => JSON.parse(text));
	} catch (error) {
		Logger.error(`Failed to parse metro cache ${detachedFile(field)}:`, error);
	}
}

function writeFile(file: CacheFile, path: string, value: SettingsValue): boolean {
	const text = benchSpan(`metro cache stringify ${path}`, () => JSON.stringify(value));

	if (benchSpan(`metro cache write ${path}`, () => file.write(path, text))) {
		return true;
	}

	Logger.error(`Failed to write metro cache ${path}.`);

	return false;
}

/**
 * @description Saves the metro cache: to its file, each detached field to its own, or the changed fields to the
 * settings Bucket. The cache file is rewritten only when one of its own fields changed.
 * @param state The whole cache; a detached field is read only when it changed.
 * @param fields The fields that changed since the last save.
 * @param detached The fields kept in their own files.
 */
export function writeStoredCache(
	state: Record<string, SettingsValue>,
	fields: Iterable<string>,
	detached: readonly string[] = [],
) {
	const file = cacheFile();
	const changed = [...fields];

	if (!file) {
		const bucket = getBucket(LEGACY_BUCKET);

		for (const field of changed) {
			bucket.set(field, state[field]);
		}

		return;
	}

	for (const field of changed.filter((name) => detached.includes(name))) {
		writeFile(file, detachedFile(field), state[field]);
	}

	if (changed.every((name) => detached.includes(name))) return;

	const own = Object.keys(state).filter((name) => !detached.includes(name));

	if (!writeFile(file, CACHE_FILE, Object.fromEntries(own.map((name) => [name, state[name]])))) {
		return;
	}

	if (!migrating) {
		return;
	}

	migrating = false;
	getBucket(LEGACY_BUCKET).clear();
}
