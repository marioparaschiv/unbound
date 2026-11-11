import { parseSync, transformSync, Visitor } from 'rolldown/utils';
import { relative, resolve, sep } from 'node:path';
import MagicString from 'magic-string';
import type { Plugin } from 'rollup';

import {
	readPluginSettings,
	SETTINGS_FILE,
	SETTINGS_MODULE,
	SETTINGS_SCHEMA_MODULE,
	settingsPath,
	type PluginSettings,
} from './settings-read.ts';
import {
	pluginDiagnostic,
	reportDiagnostics,
	reportProblem,
	type Diagnostic,
} from './diagnostic.ts';
import { settingsTypings, writeSettingsTypings } from './settings-typings.ts';
import { isGuardedSource, valueImports } from './settings-guard.ts';
import { lineStarts, toLocation } from './settings-source.ts';

/** What the settings plugins share within one build: the read settings. */
export type SettingsState = { settings?: PluginSettings };

const VIRTUAL_ID = '\0unbound-settings';
const FIX = `read settings from '${SETTINGS_MODULE}'`;
const PANEL_EXPORT = 'SettingsPanel';
const REGISTER_ACTIONS = '__registerActions';

/** The `ubd check` id these plugins report under. */
export const CHECK = 'settings';

function isTypeBox(source: string): boolean {
	return source === 'typebox' || source.startsWith('typebox/');
}

function isTypeBoxFile(id: string): boolean {
	return id.includes(`${sep}node_modules${sep}typebox${sep}`) || id.includes(`${sep}typebox@`);
}

function isPath(source: string): boolean {
	return source.startsWith('.') || source.startsWith('/') || source.startsWith('~/');
}

/**
 * @description Writes the module plugin source imports as `@unbound-app/settings`: the typed settings, the hook,
 * the generated panel, and the predicates lifted out of settings.ts. It is TypeScript, as the predicates were written.
 * @param settings The plugin's validated settings.
 * @returns The module source.
 */
export function settingsModuleSource({ schema, predicates }: PluginSettings): string {
	const lifted = new Map<string, string[]>();

	for (const { path, option, source } of predicates) {
		lifted.set(path, [...(lifted.get(path) ?? []), `${option}: (${source})`]);
	}

	const table = [...lifted].map(
		([path, options]) => `${JSON.stringify(path)}: { ${options.join(', ')} }`,
	);

	return [
		"import { define } from '@unbound-app/api/storage';",
		"import { SchemaPanel } from '@unbound-app/api/ui';",
		"import { messages, useMessages } from '@unbound-app/i18n';",
		"import { createElement } from 'react';",
		`const predicates = { ${table.join(', ')} };`,
		// The entry hands src/actions.ts over: importing it here would cycle back through actions that read `settings`.
		'let actions = {};',
		`export function ${REGISTER_ACTIONS}(next) { actions = next; }`,
		`const defined = define(${JSON.stringify(schema)});`,
		'export const settings = defined.values;',
		'export const useSetting = defined.useSetting;',
		'export const resetSettings = defined.reset;',
		`export function ${PANEL_EXPORT}() { return createElement(SchemaPanel, { settings: defined, messages, useMessages, predicates, actions, pluginId: addon.id }); }`,
	].join('\n');
}

/**
 * @description Validates and evaluates a plugin's settings.ts, writes its typings, serves `@unbound-app/settings`,
 * and fails the build on any value import of the builders, TypeBox or the schema file from plugin source.
 * @param pluginRoot The plugin's directory.
 * @param state Receives the read settings, for {@link settingsPanel}.
 * @returns The rollup plugin. It reads TypeScript, so it goes before the TypeScript transform.
 */
export function settingsModule(pluginRoot: string, state: SettingsState = {}): Plugin {
	const schemaPath = settingsPath(pluginRoot);

	return {
		name: 'unbound-settings',
		async buildStart() {
			this.addWatchFile(schemaPath);
			state.settings = await readPluginSettings(pluginRoot);

			const { settings } = state;

			if (!settings) return;

			for (const file of settings.watchFiles) this.addWatchFile(file);

			reportDiagnostics(this, settings.issues);

			if (settings.actionsPath) {
				this.addWatchFile(settings.actionsPath);
			}

			writeSettingsTypings(
				pluginRoot,
				settingsTypings(settings.schema, settings.messages, Boolean(settings.actionsPath)),
			);
		},
		resolveId(source, importer) {
			if (source === SETTINGS_MODULE) {
				return VIRTUAL_ID;
			}

			if (source === SETTINGS_SCHEMA_MODULE) {
				reportProblem(this, CHECK, pluginRoot, {
					file: importer ?? '',
					severity: 'error',
					message: `imports '${source}', which only ${SETTINGS_FILE} may use`,
					fix: FIX,
				});
			}

			return null;
		},
		load(id) {
			if (id === schemaPath || isTypeBoxFile(id)) {
				reportProblem(this, CHECK, pluginRoot, {
					file: id,
					severity: 'error',
					message: `${relative(pluginRoot, id)} would be bundled`,
					fix: FIX,
				});
			}

			if (id !== VIRTUAL_ID) return null;

			if (!state.settings) {
				return reportProblem(this, CHECK, pluginRoot, {
					file: SETTINGS_FILE,
					severity: 'error',
					message: `The plugin imports '${SETTINGS_MODULE}' but has no ${SETTINGS_FILE}`,
					fix: `add ${SETTINGS_FILE} beside src/`,
				});
			}

			return transformSync('unbound-settings.ts', settingsModuleSource(state.settings)).code;
		},
		async transform(code, id) {
			if (!id.startsWith(resolve(pluginRoot, 'src') + sep) || !isGuardedSource(id))
				return null;

			const starts = lineStarts(code);
			const problems: Diagnostic[] = [];

			for (const { source, start } of valueImports(code, id)) {
				const resolved = isPath(source) ? await this.resolve(source, id) : null;

				if (
					source !== SETTINGS_SCHEMA_MODULE &&
					!isTypeBox(source) &&
					resolved?.id !== schemaPath
				) {
					continue;
				}

				const { line, column } = toLocation(starts, start);

				problems.push(
					pluginDiagnostic(CHECK, pluginRoot, {
						file: id,
						line,
						column,
						severity: 'error',
						message: `imports '${source}', which only ${SETTINGS_FILE} may value-import`,
						fix: `${FIX}; \`import type\` stays allowed`,
					}),
				);
			}

			reportDiagnostics(this, problems);

			return null;
		},
	};
}

/**
 * @description Tells whether an entry module exports its own `SettingsPanel`, as a function, a const or a specifier.
 * @param code The entry's source.
 * @param id The entry's path.
 * @returns Whether it does.
 */
export function hasCustomPanel(code: string, id: string): boolean {
	const { program } = parseSync(id, code);
	let found = false;

	function check(name: string | undefined) {
		found ||= name === PANEL_EXPORT;
	}

	new Visitor({
		ExportNamedDeclaration(node) {
			const { declaration } = node;

			if (declaration?.type === 'FunctionDeclaration') {
				check(declaration.id?.name);
			}

			if (declaration?.type === 'VariableDeclaration') {
				for (const declarator of declaration.declarations) {
					if (declarator.id.type === 'Identifier') {
						check(declarator.id.name);
					}
				}
			}

			for (const spec of node.specifiers) {
				check(
					spec.exported.type === 'Identifier'
						? spec.exported.name
						: String(spec.exported.value),
				);
			}
		},
	}).visit(program);

	return found;
}

/**
 * @description Hands src/actions.ts to the generated panel from the plugin's entry, so neither imports the other, and
 * gives a plugin with a settings.ts and no `SettingsPanel` export the generated panel by re-exporting it.
 * @param entry The entry module's path.
 * @param state The settings {@link settingsModule} read.
 * @returns The rollup plugin. It goes before the TypeScript transform, after the entry's export checks.
 */
export function settingsPanel(entry: string, state: SettingsState): Plugin {
	return {
		name: 'unbound-settings-panel',
		transform(code, id) {
			if (id !== entry || !state.settings) return null;

			const { actionsPath } = state.settings;
			const custom = hasCustomPanel(code, id);

			if (custom && !actionsPath) return null;

			const output = new MagicString(code);

			if (actionsPath) {
				output.append(
					[
						'',
						`import * as __unboundSettingsActions from ${JSON.stringify(actionsPath)};`,
						`import { ${REGISTER_ACTIONS} } from '${SETTINGS_MODULE}';`,
						`${REGISTER_ACTIONS}(__unboundSettingsActions);`,
					].join('\n'),
				);
			}

			if (!custom) {
				output.append(`\nexport { ${PANEL_EXPORT} } from '${SETTINGS_MODULE}';`);
			}

			output.append('\n');

			return { code: output.toString(), map: output.generateMap({ hires: true }) };
		},
	};
}

export default { CHECK, hasCustomPanel, settingsModule, settingsModuleSource, settingsPanel };
