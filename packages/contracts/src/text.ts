function isStorableString(text: string): boolean {
	return !text.includes('\0') && text.isWellFormed();
}

/**
 * @description Tells whether Postgres can store a parsed JSON value as text or `json` and read it back
 * with `->>`: no string or key holds NUL (U+0000) or an unpaired UTF-16 surrogate.
 * @param value The value, as `JSON.parse` or a schema returns it.
 * @returns Whether every string and key in it is storable.
 */
// UNKNOWN: any JSON value, such as a request body before its schema runs.
export function isPostgresSafe(value: unknown): boolean {
	if (typeof value === 'string') {
		return isStorableString(value);
	}

	if (Array.isArray(value)) {
		return value.every(isPostgresSafe);
	}

	if (value && typeof value === 'object') {
		return Object.entries(value).every(
			([key, item]) => isStorableString(key) && isPostgresSafe(item),
		);
	}

	return true;
}

export default { isPostgresSafe };
