import type { Bucket, SettingsPayload, SettingsPredicate } from '../src/storage';
import type { SettingsObject, SettingsValue } from '../src/global';
import type { Widen } from '../src/utils';

/** In-memory Buckets: `storage.getBucket(name)` without a device, and the settings each holds. */
export type MemoryStorage = {
	/** Every Bucket's settings, by Bucket name. A Bucket left empty has no entry, as on disk. */
	data: Map<string, SettingsObject>;
	/** Returns a Bucket by name, or the default Bucket when `name` is omitted. */
	getBucket: (name?: string) => Bucket;
	/** Returns a Bucket by name. Without a renderer there is nothing to re-render. */
	useBucket: (name: string, predicate?: SettingsPredicate) => Bucket;
	/** Calls `callback` for each change the predicate accepts, until the returned function runs. */
	onChange: (
		predicate: SettingsPredicate,
		callback: (payload: SettingsPayload) => void,
	) => () => void;
};

function isSettingsObject(value: SettingsValue | undefined): value is SettingsObject {
	return typeof value === 'object' && value !== null;
}

/**
 * @description Creates in-memory Buckets that keep settings for the life of a test, with the client storage's semantics.
 * @param defaultName The Bucket `getBucket()` returns without a name, such as the plugin's id.
 * @returns The storage, with each Bucket's settings readable from `data`.
 */
export function createMemoryStorage(defaultName: string = 'test-addon'): MemoryStorage {
	const data = new Map<string, SettingsObject>();
	const listeners = new Set<(payload: SettingsPayload) => void>();

	function emit(payload: SettingsPayload) {
		for (const listener of listeners) listener(payload);
	}

	function get<T>(store: string, key: string, def: T): Widen<T> {
		let result: SettingsValue | undefined = data.get(store);

		for (const segment of key.split('.')) {
			const next: SettingsValue | undefined = isSettingsObject(result)
				? result[segment]
				: void 0;

			if (next === void 0) {
				return def as Widen<T>;
			}

			result = next;
		}

		return result as Widen<T>;
	}

	function set(store: string, key: string, value: SettingsValue) {
		const keys = key.split('.');
		const last = keys.pop() ?? key;
		let current = data.get(store);

		if (!current) {
			current = {};
			data.set(store, current);
		}

		for (const segment of keys) {
			const next: SettingsValue = (current[segment] ??= {});

			if (!isSettingsObject(next)) {
				throw new TypeError(`Cannot set ${store}.${key}: ${segment} is not an object.`);
			}

			current = next;
		}

		current[last] = value;
		emit({ store, key, value });
	}

	function remove(store: string, key: string) {
		const keys = key.split('.');
		const last = keys.pop() ?? key;
		const parents: SettingsObject[] = [];
		let current: SettingsValue | undefined = data.get(store);

		for (const segment of keys) {
			if (!isSettingsObject(current)) return;

			parents.push(current);
			current = current[segment];
		}

		if (!isSettingsObject(current) || current[last] === undefined) return;

		delete current[last];

		for (let index = keys.length - 1; index >= 0; index--) {
			const parent = parents[index];
			const segment = keys[index];

			if (!parent || segment === undefined) {
				break;
			}

			const child = parent[segment];

			if (!isSettingsObject(child) || Object.keys(child).length > 0) {
				break;
			}

			delete parent[segment];
		}

		if (Object.keys(data.get(store) ?? {}).length === 0) {
			data.delete(store);
		}

		emit({ store, key, value: undefined });
	}

	function clear(store: string) {
		if (!data.delete(store)) return;

		emit({ store, key: null, value: undefined });
	}

	function getBucket(name: string = defaultName): Bucket {
		return {
			get: (key, def) => get(name, key, def),
			set: (key, value) => set(name, key, value),
			toggle: (key, def) => set(name, key, !get(name, key, def)),
			remove: (key) => remove(name, key),
			clear: () => clear(name),
		};
	}

	function onChange(predicate: SettingsPredicate, callback: (payload: SettingsPayload) => void) {
		function listener(payload: SettingsPayload) {
			if (predicate(payload)) {
				callback(payload);
			}
		}

		listeners.add(listener);

		return () => void listeners.delete(listener);
	}

	return { data, getBucket, useBucket: (name) => getBucket(name), onChange };
}
