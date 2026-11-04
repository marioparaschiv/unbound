import {
	LOCALES_DIRECTORY,
	SOURCE_LOCALE,
	getLocalePath,
	isLocaleCode,
} from '@unbound-app/contracts/addon-locales';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { Plugin } from 'rollup';

import { icuArgumentType, readIcuArguments, typeKey, type IcuArguments } from './icu-arguments.ts';
import { reportProblem } from './diagnostic.ts';
import { reportLine } from './report-line.ts';

/** One locale's messages, keyed by message key. */
export type LocaleTable = Record<string, string>;

/** A translation as the build emits it: its minified JSON and that text's SHA-256. */
export type EmittedLocale = { text: string; digest: string };

/** A plugin's `i18n/` folder, validated against its en-US file. */
export type LocaleFolder = {
	source: LocaleTable;
	translations: Map<string, EmittedLocale>;
	warnings: LocaleWarning[];
};

/** A translation problem the build keeps going past: the file, the key, and what is wrong. */
export type LocaleWarning = { file: string; path: string; message: string; fix?: string };

/** The bare specifier a plugin imports its own messages from; the build resolves it to a generated module. */
export const LOCALE_MODULE = '@unbound-app/i18n';

/**
 * Where `ubd build` and `ubd dev` write the ambient typings of {@link LOCALE_MODULE}, relative to the plugin.
 * It sits in `src/`, which every plugin tsconfig includes, so the editor finds it with no setup.
 */
export const LOCALE_TYPINGS = 'src/unbound-i18n.d.ts';

const VIRTUAL_ID = '\0unbound-locales';

// The `ubd check` id these plugins report under.
const CHECK = 'locales';

/**
 * @description Names the en-US file whose presence turns a plugin's locale support on.
 * @param pluginRoot The plugin's directory.
 * @returns The absolute path of `i18n/en-US.json`.
 */
export function sourceLocalePath(pluginRoot: string): string {
	return join(pluginRoot, LOCALES_DIRECTORY, `${SOURCE_LOCALE}.json`);
}

/**
 * @description Reads one locale file as a table of message keys to strings.
 * @param path The file's absolute path.
 * @returns The table; throws naming the file when it is not valid JSON or not an object of strings.
 */
export function readTable(path: string): LocaleTable {
	let value: unknown;

	try {
		value = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		throw new Error(`${path} is not valid JSON: ${(error as Error).message}`);
	}

	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`${path} must be a JSON object of message keys to strings.`);
	}

	const table: LocaleTable = {};

	for (const [key, message] of Object.entries(value)) {
		if (typeof message !== 'string') {
			throw new Error(`${path}: ${key} must be a string, not ${typeof message}.`);
		}

		table[key] = message;
	}

	return table;
}

function argumentsOf(path: string, key: string, message: string): IcuArguments {
	try {
		return readIcuArguments(message);
	} catch (error) {
		throw new Error(
			`${path}: ${key} is not valid ICU MessageFormat: ${(error as Error).message}.`,
		);
	}
}

function sameNames(left: IcuArguments, right: IcuArguments): boolean {
	return left.size === right.size && [...left.keys()].every((name) => right.has(name));
}

function names(found: IcuArguments): string {
	return found.size ? [...found.keys()].map((name) => `{${name}}`).join(', ') : 'none';
}

function readTranslation(
	path: string,
	code: string,
	source: LocaleTable,
	warnings: LocaleWarning[],
): EmittedLocale {
	const table = readTable(path);
	const kept: LocaleTable = {};

	for (const [key, message] of Object.entries(table)) {
		const expected = source[key];

		if (expected === undefined) {
			warnings.push({
				file: `${LOCALES_DIRECTORY}/${code}.json`,
				path: key,
				message: `is not in ${SOURCE_LOCALE}.json, so it is left out`,
				fix: `add it to ${SOURCE_LOCALE}.json, or remove it (ubd i18n --prune)`,
			});
			continue;
		}

		const found = argumentsOf(path, key, message);
		const wanted = argumentsOf(path, key, expected);

		if (!sameNames(found, wanted)) {
			warnings.push({
				file: `${LOCALES_DIRECTORY}/${code}.json`,
				path: key,
				message: `has placeholders ${names(found)}, but ${SOURCE_LOCALE}.json has ${names(wanted)}`,
				fix: `use the placeholders ${SOURCE_LOCALE}.json uses`,
			});
		}

		kept[key] = message;
	}

	const text = JSON.stringify(kept);

	return { text, digest: createHash('sha256').update(text).digest('hex') };
}

/**
 * @description Reads and validates a plugin's `i18n/` folder: every file must be a JSON object of strings in
 * valid ICU syntax, and en-US.json is required. Keys en-US lacks, and placeholders it disagrees on, are warnings.
 * @param pluginRoot The plugin's directory.
 * @returns The folder, or `undefined` when the plugin has none; throws naming the file that is invalid.
 */
export function readLocaleFolder(pluginRoot: string): LocaleFolder | undefined {
	const directory = join(pluginRoot, LOCALES_DIRECTORY);

	if (!existsSync(directory)) return;

	const files = readdirSync(directory).filter((name) => name.endsWith('.json'));

	if (files.length === 0) return;

	const sourcePath = sourceLocalePath(pluginRoot);

	if (!existsSync(sourcePath)) {
		throw new Error(
			`${directory} has translations but no ${SOURCE_LOCALE}.json, which every plugin must ship.`,
		);
	}

	const source = readTable(sourcePath);
	const translations = new Map<string, EmittedLocale>();
	const warnings: LocaleWarning[] = [];

	for (const [key, message] of Object.entries(source)) {
		argumentsOf(sourcePath, key, message);
	}

	for (const file of files.sort()) {
		const code = file.slice(0, -'.json'.length);

		if (code === SOURCE_LOCALE) {
			continue;
		}

		if (!isLocaleCode(code)) {
			throw new Error(
				`${join(directory, file)} is not named after a Discord locale code, such as de.json or pt-BR.json.`,
			);
		}

		translations.set(code, readTranslation(join(directory, file), code, source, warnings));
	}

	return { source, translations, warnings };
}

function comment(message: string): string {
	return message.replaceAll('*/', '*\\/').replaceAll('\n', ' ');
}

/**
 * @description Writes the typings of {@link LOCALE_MODULE} from en-US, as an ambient module declaration:
 * `messages` has its keys, and `format` takes each key's placeholders, typed from their ICU argument types.
 * @param source The en-US messages.
 * @returns The `.d.ts` source.
 */
export function localeTypings(source: LocaleTable): string {
	const messages: string[] = [];
	const vars: string[] = [];

	for (const [key, message] of Object.entries(source)) {
		const name = typeKey(key);
		const found = readIcuArguments(message);

		messages.push(`\t\t/** ${comment(message)} */\n\t\treadonly ${name}: string;`);

		if (found.size) {
			const fields = [...found].map(
				([argument, type]) => `${typeKey(argument)}: ${icuArgumentType(type)}`,
			);

			vars.push(`\t\t${name}: { ${fields.join('; ')} };`);
		}
	}

	return [
		'// Generated by ubd from i18n/en-US.json. Do not edit: `ubd build` and `ubd dev` rewrite it.',
		'',
		`declare module '${LOCALE_MODULE}' {`,
		"\t/** Every en-US message, read in the user's locale. */",
		`\texport type Messages = {\n${messages.join('\n')}\n\t};`,
		'',
		'\t/** The placeholder values each message that has placeholders takes. */',
		vars.length
			? `\texport type FormatVars = {\n${vars.join('\n')}\n\t};`
			: '\texport type FormatVars = Record<never, never>;',
		'',
		"\t/** Each message in the user's locale, falling back to en-US. */",
		'\texport const messages: Messages;',
		'\t/** Formats a message that has no placeholders. */',
		'\texport function format(key: Exclude<keyof Messages, keyof FormatVars>): string;',
		'\t/** Formats a message, filling its placeholders from `vars`. */',
		'\texport function format<K extends keyof FormatVars>(key: K, vars: FormatVars[K]): string;',
		'\t/**',
		"\t * Re-renders the component when the user's locale changes or its translation loads, and returns the locale code.",
		'\t * The build adds it to components and hooks that read `messages` or `format`.',
		'\t */',
		'\texport function useMessages(): string;',
		'',
		"\t/** Every key of the plugin's en-US.json. */",
		'\texport type MessageKey = keyof Messages;',
		'',
		'\tglobal {',
		"\t\t/** Gives the plugin's commands, toasts and dialogs its message keys. */",
		'\t\t// oxlint-disable-next-line typescript/consistent-type-definitions -- merging needs an interface.',
		'\t\tinterface UnboundMessageKeys extends Record<MessageKey, true> {}',
		'\t}',
		'}',
		'',
	].join('\n');
}

/**
 * @description Rewrites `src/unbound-i18n.d.ts` from the plugin's en-US file, leaving the file alone when it is current.
 * @param pluginRoot The plugin's directory.
 * @returns Whether the file changed; `false` when the plugin has no en-US file. Throws when en-US is invalid.
 */
export function writeLocaleTypings(pluginRoot: string): boolean {
	const sourcePath = sourceLocalePath(pluginRoot);

	if (!existsSync(sourcePath)) {
		return false;
	}

	const typings = localeTypings(readTable(sourcePath));
	const path = join(pluginRoot, LOCALE_TYPINGS);

	if (existsSync(path) && readFileSync(path, 'utf8') === typings) {
		return false;
	}

	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, typings);

	return true;
}

/**
 * @description The source of {@link LOCALE_MODULE}: en-US inlined as the synchronous fallback, and the other
 * locales read from beside the installed bundle by the plugin's scoped `i18n.createLocales`.
 * @param source The en-US messages.
 * @returns The module's source.
 */
export function localeModuleSource(source: LocaleTable): string {
	return [
		"import { i18n } from '@unbound-app/api';",
		`const locales = i18n.createLocales(${JSON.stringify(source)});`,
		'export const messages = locales.messages;',
		'export const format = locales.format;',
		'export const useMessages = locales.useMessages;',
	].join('\n');
}

function importTarget(source: string, importer: string, pluginRoot: string): string | undefined {
	if (source.startsWith('~/')) {
		return resolve(pluginRoot, 'src', source.slice(2));
	}

	if (source.startsWith('.')) {
		return resolve(dirname(importer), source);
	}

	return undefined;
}

// The folder itself, its files and a folder `index` all go around the module, so each is refused.
function isInsideFolder(target: string, folder: string): boolean {
	return target === folder || dirname(target) === folder;
}

/**
 * @description Resolves {@link LOCALE_MODULE} to one generated module for the plugin being built, and refuses
 * an import of the `i18n/` folder or its files by path: a JSON file would put that language in the bundle.
 * @param pluginRoot The plugin's directory.
 * @returns The rollup plugin.
 */
export function localeModule(pluginRoot: string): Plugin {
	const folder = join(pluginRoot, LOCALES_DIRECTORY);

	return {
		name: 'unbound-locale-module',
		resolveId(source, importer) {
			if (source === LOCALE_MODULE) {
				if (!existsSync(sourceLocalePath(pluginRoot))) {
					reportProblem(this, CHECK, pluginRoot, {
						file: importer ?? LOCALES_DIRECTORY,
						severity: 'error',
						message: `imports ${LOCALE_MODULE}, but the plugin has no ${LOCALES_DIRECTORY}/${SOURCE_LOCALE}.json`,
						fix: `add ${LOCALES_DIRECTORY}/${SOURCE_LOCALE}.json beside src/, with every message key`,
					});
				}

				return VIRTUAL_ID;
			}

			const target = importer && importTarget(source, importer, pluginRoot);

			if (!target || !isInsideFolder(target, folder)) return null;

			reportProblem(this, CHECK, pluginRoot, {
				file: importer ?? '',
				severity: 'error',
				message: `imports ${source} by path, which would bundle its languages`,
				fix: `import from '${LOCALE_MODULE}' instead: it inlines en-US and loads the rest on demand`,
			});

			return null;
		},
		load(id) {
			if (id !== VIRTUAL_ID) return null;

			const sourcePath = sourceLocalePath(pluginRoot);

			this.addWatchFile(sourcePath);

			return localeModuleSource(readTable(sourcePath));
		},
		// In `transform`, so rollup's cache replays the line on a rebuild that skips this module.
		transform(code, id) {
			if (id !== VIRTUAL_ID) return null;

			this.emitFile(
				reportLine({
					section: 'inlined',
					label: `${SOURCE_LOCALE} strings`,
					bytes: Buffer.byteLength(code),
				}),
			);

			return null;
		},
	};
}

/**
 * @description Validates the plugin's `i18n/` folder, writes the typings of {@link LOCALE_MODULE}, emits each
 * locale but en-US beside the bundle as `i18n/<code>.json`, and lists their SHA-256 under `locales` in the dist manifest.
 * @param pluginRoot The plugin's directory.
 * @returns The rollup plugin.
 */
export function locales(pluginRoot: string): Plugin {
	let folder: LocaleFolder | undefined;

	return {
		name: 'unbound-locales',
		buildStart() {
			try {
				folder = readLocaleFolder(pluginRoot);
			} catch (error) {
				reportProblem(this, CHECK, pluginRoot, {
					file: LOCALES_DIRECTORY,
					severity: 'error',
					message: (error as Error).message,
				});
			}

			if (!folder) return;

			for (const warning of folder.warnings) {
				reportProblem(this, CHECK, pluginRoot, { ...warning, severity: 'warning' });
			}

			for (const file of readdirSync(join(pluginRoot, LOCALES_DIRECTORY))) {
				if (!file.endsWith('.json')) {
					continue;
				}

				this.addWatchFile(join(pluginRoot, LOCALES_DIRECTORY, file));
			}

			writeLocaleTypings(pluginRoot);
		},
		generateBundle(_options, bundle) {
			const manifest = bundle['manifest.json'];

			if (!folder?.translations.size || manifest?.type !== 'asset') return;

			const parsed = JSON.parse(String(manifest.source));
			const digests: Record<string, string> = {};

			for (const [code, { text, digest }] of folder.translations) {
				digests[code] = digest;
				this.emitFile({
					type: 'asset',
					fileName: getLocalePath(parsed.main, code),
					source: text,
				});
			}

			manifest.source = `${JSON.stringify({ ...parsed, locales: digests }, null, '\t')}\n`;
		},
	};
}

export default {
	LOCALE_MODULE,
	LOCALE_TYPINGS,
	sourceLocalePath,
	readLocaleFolder,
	localeTypings,
	writeLocaleTypings,
	localeModuleSource,
	localeModule,
	locales,
};
