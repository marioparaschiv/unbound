import type { LocaleStrings } from './locale-strings';

/** The file in the Unbound folder the native loader reads its screens' text from at launch. */
export const LOADER_STRINGS_FILE = 'Unbound/i18n/loader.json';

const NATIVE_KEY_PREFIX = 'UNBOUND_NATIVE_';

/**
 * @description Picks the native loader's strings for a locale, falling back to en-US for each one it lacks.
 * @param table The locale's messages, or `undefined` before it loads.
 * @param fallback The en-US messages, which name every loader key.
 * @returns Each loader key mapped to its text.
 */
export function pickLoaderStrings(
	table: LocaleStrings | undefined,
	fallback: LocaleStrings,
): LocaleStrings {
	const picked: LocaleStrings = {};

	for (const [key, english] of Object.entries(fallback)) {
		if (key.startsWith(NATIVE_KEY_PREFIX)) {
			picked[key] = table?.[key] || english;
		}
	}

	return picked;
}
