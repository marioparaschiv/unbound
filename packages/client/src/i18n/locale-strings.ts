/** One locale's messages, keyed by message key. */
export type LocaleStrings = Record<string, string>;

/** The values `format` puts into a message's ICU `MessageFormat` placeholders, by placeholder name. */
export type FormatVars = Record<string, string | number | boolean | Date>;

/**
 * @description Parses a locale's string table, as served, cached or read from an addon's folder.
 * @param text The table's JSON.
 * @returns The table, mapping each key to its string; throws when it is not an object of strings.
 */
export function parseLocaleStrings(text: string): LocaleStrings {
	const value: unknown = JSON.parse(text);

	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error('A locale table must be a JSON object.');
	}

	const table: LocaleStrings = {};

	for (const [key, string] of Object.entries(value)) {
		if (typeof string !== 'string') {
			throw new Error(`Locale string ${key} is not a string.`);
		}

		table[key] = string;
	}

	return table;
}

export default { parseLocaleStrings };
