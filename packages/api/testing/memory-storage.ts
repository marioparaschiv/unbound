import type { SettingsObject, SettingsValue } from '../src/global';
import type { Bucket } from '../src/storage';
import type { Widen } from '../src/utils';

/** In-memory Buckets: `storage.getBucket(name)` without a device, and the settings each holds. */
export type MemoryStorage = {
	/** Every Bucket's settings, by Bucket name. */
	data: Map<string, SettingsObject>;
	/** Returns a Bucket by name, or the default Bucket when `name` is omitted. */
	getBucket: (name?: string) => Bucket;
};

function isObject(value: SettingsValue | undefined): value is SettingsObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function read(settings: SettingsObject, key: string): SettingsValue | undefined {
	let current: SettingsValue | undefined = settings;

	for (const part of key.split('.')) {
		if (!isObject(current)) return;

		current = current[part];
	}

	return current;
}

function write(settings: SettingsObject, key: string, value: SettingsValue) {
	const parts = key.split('.');
	const last = parts.pop() ?? key;
	let current = settings;

	for (const part of parts) {
		const next = current[part];

		current = isObject(next) ? next : (current[part] = {});
	}

	current[last] = value;
}

function createBucket(settings: SettingsObject): Bucket {
	const bucket: Bucket = {
		get: <T>(key: string, def: T) => (read(settings, key) ?? def) as Widen<T>,
		set: (key, value) => write(settings, key, value),
		toggle: (key, def) => write(settings, key, !(read(settings, key) ?? def)),
		remove(key) {
			const parts = key.split('.');
			const last = parts.pop() ?? key;
			const parent = parts.length > 0 ? read(settings, parts.join('.')) : settings;

			if (isObject(parent)) {
				delete parent[last];
			}
		},
		clear() {
			for (const key of Object.keys(settings)) delete settings[key];
		},
		useSettingsStore: () => bucket,
		addListener: () => () => {},
	};

	return bucket;
}

/**
 * @description Creates in-memory Buckets that keep settings for the life of a test.
 * @param defaultName The Bucket `getBucket()` returns without a name, such as the plugin's id.
 * @returns The storage, with each Bucket's settings readable from `data`.
 */
export function createMemoryStorage(defaultName: string = 'test-addon'): MemoryStorage {
	const data = new Map<string, SettingsObject>();
	const buckets = new Map<string, Bucket>();

	function getBucket(name: string = defaultName): Bucket {
		let bucket = buckets.get(name);

		if (!bucket) {
			const settings: SettingsObject = {};

			data.set(name, settings);
			bucket = createBucket(settings);
			buckets.set(name, bucket);
		}

		return bucket;
	}

	return { data, getBucket };
}
