export type LruCache<K, V> = {
	get: (key: K) => V | undefined;
	set: (key: K, value: V) => void;
	delete: (key: K) => void;
};

/**
 * @description Creates a map that holds at most `limit` entries, evicting the least recently read or written.
 * @template K The key type.
 * @template V The value type.
 * @param limit The most entries kept.
 * @returns The cache.
 */
export function createLruCache<K, V>(limit: number): LruCache<K, V> {
	const entries = new Map<K, V>();

	function touch(key: K, value: V) {
		entries.delete(key);
		entries.set(key, value);
	}

	return {
		get: (key) => {
			const value = entries.get(key);

			if (value !== undefined) {
				touch(key, value);
			}

			return value;
		},
		set: (key, value) => {
			touch(key, value);

			for (const oldest of entries.keys()) {
				if (entries.size <= limit) {
					break;
				}

				entries.delete(oldest);
			}
		},
		delete: (key) => {
			entries.delete(key);
		},
	};
}

export default { createLruCache };
