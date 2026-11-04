/**
 * @description Creates a map whose entries expire a fixed time after they were set.
 * @param ttl How long an entry lives, in milliseconds.
 * @param now Reads the current time, in milliseconds.
 * @returns `has`, `get`, `set` and `clear`, like a `Map`.
 */
export function createTtlCache<K, V>(ttl: number, now: () => number = Date.now) {
	const entries = new Map<K, { value: V; expires: number }>();

	function has(key: K): boolean {
		const entry = entries.get(key);

		if (!entry) return false;
		if (entry.expires > now()) return true;

		entries.delete(key);
		return false;
	}

	return {
		has,
		get: (key: K): V | undefined => (has(key) ? entries.get(key)?.value : undefined),
		set: (key: K, value: V) => void entries.set(key, { value, expires: now() + ttl }),
		clear: () => entries.clear(),
	};
}

export type TtlCache<K, V> = ReturnType<typeof createTtlCache<K, V>>;
