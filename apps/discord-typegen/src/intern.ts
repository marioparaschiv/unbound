const pool = new Map<string, string>();

/**
 * @description Returns a pooled, standalone copy of a string. Strings sliced out of a module's text (names,
 * literals, paths) keep the whole text alive in the engine, so every string that outlives a module goes here.
 * @param value The string, possibly a slice of a large text.
 * @returns An equal string that references no other string.
 */
function intern(value: string): string {
	let pooled = pool.get(value);

	if (pooled === undefined) {
		pooled = Buffer.from(value, 'utf8').toString('utf8');
		pool.set(pooled, pooled);
	}

	return pooled;
}

export default intern;
