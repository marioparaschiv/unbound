import MagicString from 'magic-string';
import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import type { Plugin } from 'rollup';

import { pluginDiagnostic, reportDiagnostics, type Diagnostic } from './diagnostic.ts';
import { LOCALE_MODULE, readTable, sourceLocalePath } from './locales.ts';
import { checkCommandText, type SourceLocale } from './command-text.ts';

// The `ubd check` id this plugin reports under.
const CHECK = 'commands';
const sourceFile = /\.(m?[jt]sx?)$/;

/**
 * @description Reads a plugin's en-US messages, the table every command key is checked against.
 * @param pluginRoot The plugin's directory.
 * @returns The messages, or `undefined` when the plugin has no `i18n/en-US.json`; throws when it is not an object of strings.
 */
export function readSourceLocale(pluginRoot: string): SourceLocale {
	const path = sourceLocalePath(pluginRoot);

	return existsSync(path) ? readTable(path) : undefined;
}

/**
 * @description Checks every `commands.register(...)` literal against the plugin's `i18n/en-US.json` and fails the
 * build with all problems at once. A module that registers commands imports the plugin's locale module, so its
 * translations exist before `register` resolves the keys.
 * @param pluginRoot The plugin's directory.
 * @returns The rollup plugin; it must run before swc, so positions are the source file's.
 */
export function commandLocales(pluginRoot: string): Plugin {
	let source: SourceLocale;
	let problems: Diagnostic[] = [];

	return {
		name: 'unbound-command-locales',
		buildStart() {
			source = readSourceLocale(pluginRoot);
			problems = [];
			this.addWatchFile(sourceLocalePath(pluginRoot));
		},
		transform(code, id) {
			// A module without the word cannot register commands, so it skips the parse.
			if (
				id.startsWith('\0') ||
				id.includes('/node_modules/') ||
				!sourceFile.test(id) ||
				!code.includes('register')
			) {
				return null;
			}

			const result = checkCommandText(code, id, source);

			for (const { line, column, command, problem, fix } of result.problems) {
				problems.push(
					pluginDiagnostic(CHECK, pluginRoot, {
						file: relative(pluginRoot, id),
						line,
						column,
						path: command,
						severity: 'error',
						message: problem,
						fix,
					}),
				);
			}

			if (!result.registers || source === undefined) return null;

			const output = new MagicString(code).prepend(`import '${LOCALE_MODULE}';\n`);

			return { code: output.toString(), map: output.generateMap({ hires: true }) };
		},
		buildEnd(error) {
			if (error || problems.length === 0) return;

			reportDiagnostics(this, problems);
		},
	};
}

export default { commandLocales, readSourceLocale };
