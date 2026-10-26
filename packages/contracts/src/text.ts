import { z } from './zod';

/** The character Postgres text, and a `json` value read with `->>`, cannot hold. */
export const NUL = '\0';

/**
 * @description Tells whether a parsed JSON value holds NUL in any string or key.
 * @param value The value, as `JSON.parse` or a schema returns it.
 * @returns Whether NUL appears anywhere in it.
 */
// UNKNOWN: any JSON value, such as a manifest's unvalidated extra keys.
export function containsNul(value: unknown): boolean {
	if (typeof value === 'string') {
		return value.includes(NUL);
	}

	if (Array.isArray(value)) {
		return value.some(containsNul);
	}

	if (value && typeof value === 'object') {
		return Object.entries(value).some(([key, item]) => key.includes(NUL) || containsNul(item));
	}

	return false;
}

/** Refuses a string or JSON value holding NUL, which free text bound for the database must not. */
export const withoutNul = z.refine(
	(value) => !containsNul(value),
	'Must not contain the NUL character (U+0000).',
);

export default { NUL, containsNul, withoutNul };
