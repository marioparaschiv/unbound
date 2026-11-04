import { isLocaleCode } from '@unbound-app/contracts/addon-locales';
import { writeFileSync } from 'node:fs';

import {
	listTranslationCodes,
	readLocaleFile,
	readUntranslated,
	serializeTable,
	writeIfChanged,
	writeUntranslated,
	type LocaleFile,
	type UntranslatedStubs,
} from '~/lib/locale-files';
import { writeLocaleTypings, type LocaleTable } from '~/rollup/locales';
import { readIcuArguments } from '~/rollup/icu-arguments';

/** What `--fix` did to one translation. */
export type FixedLocale = {
	code: string;
	file: string;
	/** Keys added with their en-US text. */
	added: string[];
	/** Stubs whose en-US text changed, rewritten to the new text. */
	refreshed: string[];
	/** Keys en-US lacks, removed under `--prune`. */
	pruned: string[];
	changed: boolean;
	/** Why the file was left alone. */
	error: string | undefined;
};

/** What `--add` did, or why it refused. */
export type AddedKey = { error: string } | { error: undefined; typings: boolean };

type Rewrite = { table: LocaleTable; stubs: Record<string, string> } & Pick<
	FixedLocale,
	'added' | 'refreshed' | 'pruned'
>;

// Stubs hold en-US text, so the bundle shows English for them, as it would for a missing key.
function rewrite(
	table: LocaleTable,
	source: LocaleTable,
	previous: Record<string, string>,
	prune: boolean,
): Rewrite {
	const result: Rewrite = { table: {}, stubs: {}, added: [], refreshed: [], pruned: [] };

	for (const [key, english] of Object.entries(source)) {
		const current = table[key];
		const stubbed = current === undefined || previous[key] === current;

		if (current === undefined) {
			result.added.push(key);
		} else if (stubbed && current !== english) {
			result.refreshed.push(key);
		}

		result.table[key] = stubbed ? english : current;

		if (stubbed) {
			result.stubs[key] = english;
		}
	}

	for (const [key, message] of Object.entries(table)) {
		if (source[key] !== undefined) {
			continue;
		}

		if (prune) {
			result.pruned.push(key);
		} else {
			result.table[key] = message;
		}
	}

	return result;
}

function fixFile(
	file: LocaleFile,
	source: LocaleTable,
	stubs: UntranslatedStubs,
	prune: boolean,
): FixedLocale {
	const base = { code: file.code, file: file.file, added: [], refreshed: [], pruned: [] };

	if (!isLocaleCode(file.code)) {
		return { ...base, changed: false, error: `${file.file} is not named after a locale code` };
	}

	if (!file.table) {
		return { ...base, changed: false, error: file.error };
	}

	const result = rewrite(file.table, source, stubs[file.code] ?? {}, prune);

	stubs[file.code] = result.stubs;

	return {
		...base,
		added: result.added,
		refreshed: result.refreshed,
		pruned: result.pruned,
		changed: writeIfChanged(file.path, serializeTable(result.table, file.text)),
		error: void 0,
	};
}

/**
 * @description Adds every key a translation lacks, with its en-US text, in en-US's key order, and records each
 * in the untranslated sidecar so the report keeps counting it as missing. Rewriting an unchanged folder is a no-op.
 * @param pluginRoot The plugin's directory.
 * @param source The en-US messages.
 * @param prune Whether to remove keys en-US does not have.
 * @returns What changed in each translation.
 */
export function fixTranslations(
	pluginRoot: string,
	source: LocaleTable,
	prune: boolean,
): FixedLocale[] {
	const previous = readUntranslated(pluginRoot);
	const codes = listTranslationCodes(pluginRoot);
	// Stubs of a deleted translation go; an unreadable one keeps its stubs until it is fixed.
	const stubs: UntranslatedStubs = Object.fromEntries(
		Object.entries(previous).filter(([code]) => codes.includes(code)),
	);
	const fixed = codes.map((code) =>
		fixFile(readLocaleFile(pluginRoot, code), source, stubs, prune),
	);

	writeUntranslated(pluginRoot, stubs);

	return fixed;
}

function isSorted(keys: string[]): boolean {
	return keys.every((key, index) => index === 0 || keys[index - 1]! <= key);
}

/**
 * @description Adds a key to en-US, in sorted place when the file's keys are sorted and last otherwise, then
 * rewrites the `@unbound-app/i18n` typings the way `ubd dev` does.
 * @param pluginRoot The plugin's directory.
 * @param sourceFile The en-US file, already read.
 * @param key The new key.
 * @param text Its English text, in ICU MessageFormat.
 * @returns Whether the typings changed, or why the key was refused.
 */
export function addSourceKey(
	pluginRoot: string,
	sourceFile: LocaleFile,
	key: string,
	text: string,
): AddedKey {
	const table = sourceFile.table;

	if (!table) {
		return { error: sourceFile.error ?? `${sourceFile.file} could not be read` };
	}

	if (!key || !text) {
		return { error: 'Pass a key and its English text: ubd i18n --add KEY "English text".' };
	}

	if (table[key] !== undefined) {
		return { error: `${sourceFile.file} already has ${key}: ${JSON.stringify(table[key])}.` };
	}

	try {
		readIcuArguments(text);
	} catch (error) {
		return { error: `${key} is not valid ICU MessageFormat: ${(error as Error).message}.` };
	}

	const keys = Object.keys(table);
	const ordered = isSorted(keys) ? [...keys, key].sort() : [...keys, key];
	const next = Object.fromEntries(ordered.map((name) => [name, table[name] ?? text]));

	writeFileSync(sourceFile.path, serializeTable(next, sourceFile.text));

	try {
		return {
			error: void 0,
			typings: writeLocaleTypings(pluginRoot),
		};
	} catch (error) {
		return { error: `Failed to write the typings for ${key}: ${(error as Error).message}` };
	}
}
