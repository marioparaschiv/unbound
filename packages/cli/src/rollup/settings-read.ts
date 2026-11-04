import {
	isButton,
	isSettingsGroup,
	readSettingsSchema,
	type SettingsIssue,
} from '@unbound-app/contracts/settings-schema';
import type { SettingChoice, SettingsSchema } from '@unbound-app/types/settings';
import { existsSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { rolldown } from 'rolldown';

import {
	readActionExports,
	readSettingsSource,
	toLocation,
	type LiftedPredicate,
	type SettingsSource,
} from './settings-source.ts';
import { diagnostic, type Diagnostic } from './diagnostic.ts';
import { readTable, sourceLocalePath } from './locales.ts';
import { findFile } from './source-alias.ts';

// The en-US file every settings label is a key of, as messages name it.
const SOURCE_MESSAGES = 'i18n/en-US.json';

/** A plugin's settings schema file, beside `src/`. */
export const SETTINGS_FILE = 'settings.ts';

/** The runtime module plugin source reads its settings from. */
export const SETTINGS_MODULE = '@unbound-app/settings';

/** The build-time module `settings.ts` imports its builders from; it exists only while the build evaluates the file. */
export const SETTINGS_SCHEMA_MODULE = '@unbound-app/settings/schema';

/** A plugin's settings, read and validated. `issues` is empty when the schema can ship. */
export type PluginSettings = {
	schema: SettingsSchema;
	messages: Record<string, string>;
	/** The predicates lifted out of settings.ts, to compile into the plugin bundle. */
	predicates: LiftedPredicate[];
	/** Every problem, at its place in settings.ts, under the `settings` check. */
	issues: Diagnostic[];
	/** The plugin's `src/actions.ts`, whose exports its buttons run; `undefined` when it has none. */
	actionsPath: string | undefined;
	/** Every file the schema was read from, for the build to watch. */
	watchFiles: string[];
};

type Issue = SettingsIssue & { offset?: number };

/** What evaluating settings.ts gave: its default export as JSON, and the files it was bundled from. */
// UNKNOWN: settings.ts may default-export anything; readSettingsSchema checks it.
export type EvaluatedSettings = { value: unknown; watchFiles: string[] };

/** A schema node's labels, which name message keys. */
type Labelled = {
	title?: string;
	subtitle?: string;
	placeholder?: string;
	confirm?: string;
	options?: SettingChoice[];
	of?: Labelled;
};

const BUILDERS = join(import.meta.dirname, '..', 'settings', 'schema.ts');

/**
 * @description Names a plugin's settings schema file.
 * @param pluginRoot The plugin's directory.
 * @returns The absolute path of `settings.ts`.
 */
export function settingsPath(pluginRoot: string): string {
	return join(pluginRoot, SETTINGS_FILE);
}

/**
 * @description Bundles `settings.ts` in memory, resolving the builders module to the CLI's implementation, and imports it.
 * @param path The schema file.
 * @returns Its default export as JSON, and the files it was bundled from.
 */
export async function evaluateSettings(path: string): Promise<EvaluatedSettings> {
	const bundle = await rolldown({
		input: path,
		platform: 'node',
		logLevel: 'silent',
		plugins: [
			{
				name: 'unbound-settings-schema',
				resolveId: (source) => (source === SETTINGS_SCHEMA_MODULE ? BUILDERS : null),
			},
		],
	});

	try {
		const { output } = await bundle.generate({ format: 'esm' });
		const url = `data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`;
		const module = await import(url);
		const watchFiles = (await bundle.watchFiles).filter((file) => file !== BUILDERS);

		// TypeBox keeps its own markers in non-enumerable `~` keys, which JSON drops.
		return { value: JSON.parse(JSON.stringify(module.default ?? null)), watchFiles };
	} finally {
		await bundle.close();
	}
}

function readMessages(pluginRoot: string, issues: Issue[]): Record<string, string> {
	if (!existsSync(sourceLocalePath(pluginRoot))) {
		issues.push({
			path: '',
			problem: `labels are message keys, but the plugin has no ${SOURCE_MESSAGES}`,
			fix: `create ${SOURCE_MESSAGES} with a key for each title, subtitle and option`,
		});

		return {};
	}

	try {
		return readTable(sourceLocalePath(pluginRoot));
	} catch (error) {
		issues.push({
			path: '',
			problem: (error as Error).message.replace(pluginRoot + sep, ''),
			fix: 'fix its JSON',
		});

		return {};
	}
}

function screamingSnake(path: string): string {
	return path
		.replaceAll(/([a-z0-9])([A-Z])/g, '$1_$2')
		.replaceAll(/[^A-Za-z0-9]+/g, '_')
		.toUpperCase();
}

function labelsOf(node: Labelled): [string, string | undefined][] {
	const labels: [string, string | undefined][] = [
		['title', node.title],
		['subtitle', node.subtitle],
		['placeholder', node.placeholder],
		['confirm', node.confirm],
	];

	for (const options of [node.options, node.of?.options]) {
		for (const option of options ?? []) {
			labels.push(
				[`option ${option.const}`, option.title],
				[`option ${option.const} subtitle`, option.subtitle],
			);
		}
	}

	return labels;
}

function checkKeys(schema: SettingsSchema, messages: Record<string, string>, issues: Issue[]) {
	const nodes: [string, Labelled][] = schema.title ? [['', { title: schema.title }]] : [];

	for (const [key, node] of Object.entries(schema.properties)) {
		nodes.push([key, node]);

		if (isSettingsGroup(node)) {
			for (const [child, field] of Object.entries(node.properties))
				nodes.push([`${key}.${child}`, field]);
		}
	}

	for (const [path, node] of nodes) {
		for (const [label, key] of labelsOf(node)) {
			if (typeof key !== 'string' || Object.hasOwn(messages, key)) {
				continue;
			}

			const suggested = screamingSnake(
				[path || 'settings', label === 'title' ? '' : label].join('_'),
			);

			issues.push({
				path,
				problem: `${label} ${JSON.stringify(key)} is not a key of ${SOURCE_MESSAGES}`,
				fix: `add "${key}" (or "${suggested.replace(/_$/, '')}") to ${SOURCE_MESSAGES}`,
			});
		}
	}
}

function schemaNodes(schema: SettingsSchema) {
	return Object.entries(schema.properties).flatMap(([key, node]) => [
		[key, node] as const,
		...(isSettingsGroup(node)
			? Object.entries(node.properties).map(
					([child, field]) => [`${key}.${child}`, field] as const,
				)
			: []),
	]);
}

function checkPredicates(schema: SettingsSchema, source: SettingsSource, issues: Issue[]) {
	const lifted = new Set(source.predicates.map(({ path, option }) => `${path}.${option}`));
	const failed = new Set(source.problems.map(({ path }) => path));

	for (const [path, node] of schemaNodes(schema)) {
		for (const option of ['visibleWhen', 'disabledWhen'] as const) {
			const at = `${path}.${option}`;

			if (typeof node[option] === 'object' && !lifted.has(at) && !failed.has(at)) {
				issues.push({
					path: at,
					problem: 'is a predicate the build cannot find',
					fix: 'write the predicate inline in the builder options',
				});
			}
		}
	}
}

function checkActions(schema: SettingsSchema, actionsPath: string | undefined, issues: Issue[]) {
	const buttons = schemaNodes(schema).flatMap(([path, node]) =>
		!isSettingsGroup(node) && isButton(node) ? [[path, node.action] as const] : [],
	);

	if (!buttons.length) return;

	if (!actionsPath) {
		issues.push({
			path: buttons[0]?.[0] ?? '',
			problem: 'is a button, but the plugin has no src/actions.ts',
			fix: `create src/actions.ts and export function ${buttons[0]?.[1] ?? 'action'}() from it`,
		});

		return;
	}

	const exports = readActionExports(actionsPath, readFileSync(actionsPath, 'utf8'));

	for (const [path, action] of buttons) {
		if (exports.get(action)) {
			continue;
		}

		issues.push({
			path,
			problem: exports.has(action)
				? `runs "${action}", which src/actions.ts exports but not as a function`
				: `runs "${action}", which src/actions.ts does not export`,
			fix: `write \`export function ${action}() {}\` or \`export const ${action} = () => {}\` in src/actions.ts`,
		});
	}
}

function formatIssue({ path, problem, fix, offset }: Issue, source: SettingsSource): Diagnostic {
	let at = path;

	// A problem inside a property the source does not spell out is reported at its nearest written ancestor.
	while (at && !source.offsets.has(at)) at = at.slice(0, Math.max(0, at.lastIndexOf('.')));

	const found = offset ?? source.offsets.get(at);
	const { line, column } =
		found === undefined ? { line: 1, column: 1 } : toLocation(source.starts, found);

	return diagnostic({
		file: SETTINGS_FILE,
		line,
		column,
		path: path || 'settings',
		severity: 'error',
		message: problem,
		fix,
		check: 'settings',
	});
}

/**
 * @description Reads a plugin's `settings.ts`: evaluates it, validates the schema, lifts its predicates and checks every label against en-US.
 * @param pluginRoot The plugin's directory.
 * @returns The settings with every problem formatted, or `undefined` when the plugin has no settings.ts.
 */
export async function readPluginSettings(pluginRoot: string): Promise<PluginSettings | undefined> {
	const path = settingsPath(pluginRoot);

	if (!existsSync(path)) return;

	const source = readSettingsSource(path, readFileSync(path, 'utf8'));
	const issues: Issue[] = source.problems.map(({ path: at, offset, problem, fix }) => ({
		path: at,
		offset,
		problem,
		fix,
	}));
	const messages = readMessages(pluginRoot, issues);
	let schema: SettingsSchema = { kind: 'settings', properties: {} };
	let watchFiles = [path];

	try {
		const evaluated = await evaluateSettings(path);
		const result = readSettingsSchema(evaluated.value);

		({ schema } = result);
		watchFiles = evaluated.watchFiles;
		issues.push(...result.issues);
	} catch (error) {
		issues.push({
			path: '',
			problem: `failed to evaluate: ${error instanceof Error ? error.message : String(error)}`,
			fix: 'fix that error',
		});
	}

	if (Object.keys(messages).length) {
		checkKeys(schema, messages, issues);
	}

	const actionsPath = findFile(join(pluginRoot, 'src', 'actions')) ?? undefined;

	checkPredicates(schema, source, issues);
	checkActions(schema, actionsPath, issues);

	return {
		schema,
		messages,
		predicates: source.predicates,
		actionsPath,
		issues: issues.map((issue) => formatIssue(issue, source)),
		watchFiles,
	};
}
