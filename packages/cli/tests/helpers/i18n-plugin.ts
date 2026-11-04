import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readLocaleFile } from '../../src/lib/locale-files';
import { createTempDir, type TempDir } from './ubd';

/** A plugin's locale files by code, and its other files by path. */
export type PluginFiles = {
	locales: Record<string, Record<string, string> | string>;
	files?: Record<string, string>;
};

/** A complete en-US with a plural, and translations that only lack keys. */
export const PARTIAL: PluginFiles = {
	locales: {
		'en-US': {
			COUNT: '{count, plural, one {# message} other {# messages}}',
			GREETING: 'Hello, {name}!',
			OK: 'OK',
			TITLE: 'Welcome',
		},
		// "OK" is the same in German, and still counts as translated.
		de: {
			COUNT: '{count, plural, one {# Nachricht} other {# Nachrichten}}',
			GREETING: 'Hallo, {name}!',
			OK: 'OK',
			TITLE: 'Willkommen',
		},
		// Out of en-US's order, so `--fix` has to reorder it.
		fr: { TITLE: 'Bienvenue', GREETING: 'Bonjour, {name} !' },
	},
};

/** A translation with one of each problem the report fails on. */
export const BROKEN: PluginFiles = {
	locales: {
		'en-US': {
			BODY: 'Hello, {name}!',
			COUNT: '{count, plural, one {# file} other {# files}}',
			PRONOUN: '{who, select, he {him} other {them}}',
			TITLE: 'Welcome',
		},
		es: {
			BODY: 'Hola, {nombre}!',
			COUNT: '{count, plural, one {# archivo}}',
			PRONOUN: '{who, select, he {él} other {ellos}',
			TITLE: 'Bienvenido',
			OLD: 'Viejo',
		},
	},
};

/**
 * @description Writes a plugin to a temporary directory, each locale as tab-indented JSON with a trailing newline.
 * @param plugin The locale tables, or raw text for a file written as is, and any other files.
 * @returns The directory and a function that deletes it.
 */
export function createPlugin(plugin: PluginFiles): TempDir {
	const files: Record<string, string> = { ...plugin.files };

	for (const [code, table] of Object.entries(plugin.locales)) {
		files[`i18n/${code}.json`] =
			typeof table === 'string' ? table : `${JSON.stringify(table, null, '\t')}\n`;
	}

	return createTempDir(files);
}

/**
 * @description Reads a file of a plugin as text.
 * @param root The plugin directory.
 * @param path The path inside it.
 * @returns The text.
 */
export function readText(root: string, path: string): string {
	return readFileSync(join(root, path), 'utf8');
}

/**
 * @description Reads the en-US file of a plugin, asserting it parses.
 * @param root The plugin directory.
 * @returns The file and its messages.
 */
export function readSource(root: string) {
	const file = readLocaleFile(root, 'en-US');

	if (!file.table) {
		throw new Error(`en-US did not parse: ${file.error}`);
	}

	return { file, table: file.table };
}
