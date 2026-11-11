import { LOCALES_DIRECTORY, SOURCE_LOCALE } from '@unbound-app/contracts/addon-locales';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { LocaleTable } from '~/rollup/locales';

/** One file of a plugin's `i18n/` folder, read without throwing. */
export type LocaleFile = {
	code: string;
	/** The path relative to the plugin, such as `i18n/de.json`. */
	file: string;
	path: string;
	/** The raw text, kept so a rewrite can match its indentation and trailing newline. */
	text: string;
	/** The messages, or `undefined` when the file is not a JSON object of strings. */
	table: LocaleTable | undefined;
	error: string | undefined;
};

/** The stubs `ubd i18n fix` wrote, by locale code then key, holding the en-US text each was stubbed with. */
export type UntranslatedStubs = Record<string, Record<string, string>>;

/**
 * The sidecar listing the keys `ubd i18n fix` stubbed with English. It does not end in `.json`, so the build never
 * reads it as a locale and never ships it.
 */
export const UNTRANSLATED_FILE = `${LOCALES_DIRECTORY}/untranslated.jsonc`;

// UNKNOWN: any JSON value, checked below.
function toTable(value: unknown): LocaleTable | string {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return 'must be a JSON object of message keys to strings';
	}

	const table: LocaleTable = {};

	for (const [key, message] of Object.entries(value)) {
		if (typeof message !== 'string') {
			return `${key} must be a string, not ${typeof message}`;
		}

		table[key] = message;
	}

	return table;
}

/**
 * @description Reads one locale file, reporting a file that is not JSON or not an object of strings instead of throwing.
 * @param pluginRoot The plugin's directory.
 * @param code The locale code, such as `de`.
 * @returns The file, its text and its messages.
 */
export function readLocaleFile(pluginRoot: string, code: string): LocaleFile {
	const file = `${LOCALES_DIRECTORY}/${code}.json`;
	const path = join(pluginRoot, file);
	const base = { code, file, path, text: '', table: void 0, error: void 0 };

	if (!existsSync(path)) {
		return { ...base, error: `${file} does not exist` };
	}

	const text = readFileSync(path, 'utf8');
	let value: unknown;

	try {
		value = JSON.parse(text);
	} catch (error) {
		return { ...base, text, error: `${file} is not valid JSON: ${(error as Error).message}` };
	}

	const table = toTable(value);

	return typeof table === 'string'
		? { ...base, text, error: `${file}: ${table}` }
		: { ...base, text, table };
}

/**
 * @description Lists the locale codes of a plugin's translations, every `i18n/*.json` but en-US, sorted.
 * @param pluginRoot The plugin's directory.
 * @returns The codes, valid or not; the caller checks each against the Discord locale pattern.
 */
export function listTranslationCodes(pluginRoot: string): string[] {
	const directory = join(pluginRoot, LOCALES_DIRECTORY);

	if (!existsSync(directory)) {
		return [];
	}

	return readdirSync(directory)
		.filter((name) => name.endsWith('.json'))
		.map((name) => name.slice(0, -'.json'.length))
		.filter((code) => code !== SOURCE_LOCALE)
		.sort();
}

/**
 * @description Finds the line a key is written on, for a report that points into the file.
 * @param text The file's raw text.
 * @param key The message key.
 * @returns The 1-based line, or `1` when the key is not found.
 */
export function keyLine(text: string, key: string): number {
	const quoted = JSON.stringify(key);

	for (let index = text.indexOf(quoted); index !== -1; index = text.indexOf(quoted, index + 1)) {
		const after = text.slice(index + quoted.length).trimStart();

		if (after.startsWith(':')) {
			return text.slice(0, index).split('\n').length;
		}
	}

	return 1;
}

/**
 * @description Serialises a table the way an existing file is written: its indentation, tabs by default, and its trailing newline.
 * @param table The messages, in the order to write them.
 * @param like The file's current text, or `''` for a new file.
 * @returns The JSON text.
 */
export function serializeTable(table: LocaleTable | UntranslatedStubs, like: string): string {
	const indent = /\n([ \t]+)"/.exec(like)?.[1] ?? '\t';
	const newline = like === '' || like.endsWith('\n');

	return `${JSON.stringify(table, null, indent)}${newline ? '\n' : ''}`;
}

/**
 * @description Writes a file only when its text changes, so a repeated run touches nothing.
 * @param path The file.
 * @param text The new text.
 * @returns Whether the file changed.
 */
export function writeIfChanged(path: string, text: string): boolean {
	if (existsSync(path) && readFileSync(path, 'utf8') === text) {
		return false;
	}

	writeFileSync(path, text);

	return true;
}

/**
 * @description Reads the stubs `ubd i18n fix` wrote, ignoring a sidecar that is missing or not the expected shape.
 * @param pluginRoot The plugin's directory.
 * @returns The stubs by locale code, empty when there are none.
 */
export function readUntranslated(pluginRoot: string): UntranslatedStubs {
	const path = join(pluginRoot, UNTRANSLATED_FILE);

	if (!existsSync(path)) {
		return {};
	}

	let value: unknown;

	try {
		value = JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		// A hand-broken sidecar only loses the stub marks; the next `ubd i18n fix` rewrites it.
		return {};
	}

	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return {};
	}

	const stubs: UntranslatedStubs = {};

	for (const [code, entries] of Object.entries(value)) {
		const table = toTable(entries);

		if (typeof table !== 'string') {
			stubs[code] = table;
		}
	}

	return stubs;
}

/**
 * @description Writes the stubs sidecar, or deletes it once nothing is stubbed.
 * @param pluginRoot The plugin's directory.
 * @param stubs The stubs by locale code; codes with none are left out.
 * @returns Whether the sidecar changed.
 */
export function writeUntranslated(pluginRoot: string, stubs: UntranslatedStubs): boolean {
	const path = join(pluginRoot, UNTRANSLATED_FILE);
	const kept = Object.fromEntries(
		Object.entries(stubs).filter(([, entries]) => Object.keys(entries).length > 0),
	);

	if (Object.keys(kept).length === 0) {
		if (!existsSync(path)) {
			return false;
		}

		rmSync(path);

		return true;
	}

	return writeIfChanged(
		path,
		serializeTable(kept, existsSync(path) ? readFileSync(path, 'utf8') : ''),
	);
}
