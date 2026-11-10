import { createHash } from 'node:crypto';

import type { ComponentRecord, ExportEntry } from './types';
import type { ModuleShape } from './module-shapes';

import { BANNER, BARREL_FILE, specifier } from './emit';
import { literalType, propertyKey } from './rules';
import { compare } from './naming';

/** The file the module index is written to, published as `@unbound-app/discord-types/metro`. */
export const MODULE_INDEX_FILE = 'metro.gen.d.ts';

/**
 * A name at most this many lookup targets expose is distinctive. Only a target with two distinctive names is indexed,
 * and a name more targets expose is too common to narrow a lookup: its `DiscordModuleProps` entry is `string`.
 */
export const MAX_TARGETS = 3;

/** How many distinctive names a target needs to be indexed. */
export const MIN_DISTINCTIVE = 2;

/** Everything the module index needs about the build. */
export type ModuleIndexInput = {
	build: string;
	shapes: ModuleShape[];
	exports: ExportEntry[];
	names: Map<ComponentRecord, string>;
	/**
	 * The component types the index may name, all declared in {@link BARREL_FILE}: consumers load it already, and
	 * naming any other component would pull every shard into their compile.
	 */
	typed: ReadonlySet<string>;
};

/** One lookup result: a module's exports, keyed like `DiscordModules`. */
type ModuleEntry = {
	members: Map<string, string>;
	defaultKeys: string[];
};

/**
 * @description Keys a module the same way in every build: by its source path, else by a hash of its export names,
 * since numeric module ids change with every Discord build.
 * @param shape The module's shape.
 * @returns The source path, or `~` and ten hex digits of the export-name set's SHA-1.
 */
export function moduleKey(shape: ModuleShape): string {
	if (shape.path !== undefined) {
		return shape.path;
	}

	const digest = createHash('sha1').update(shape.exportNames.join('\n')).digest('hex');

	return `~${digest.slice(0, 10)}`;
}

function componentTypes(input: ModuleIndexInput): Map<string, Map<string, string>> {
	const byPath = new Map<string, Map<string, string>>();

	for (const { path, exportName, component } of input.exports) {
		const type = `${input.names.get(component)}Component`;
		const members = byPath.get(path) ?? new Map<string, string>();

		if (input.typed.has(type)) {
			byPath.set(path, members.set(exportName, type));
		}
	}

	return byPath;
}

function collectModules(input: ModuleIndexInput): Map<string, ModuleEntry> {
	const components = componentTypes(input);
	const modules = new Map<string, ModuleEntry>();

	for (const shape of input.shapes) {
		if (shape.exportNames.length === 0) {
			continue;
		}

		const key = moduleKey(shape);
		const typed = (shape.path !== undefined && components.get(shape.path)) || new Map();
		const entry = modules.get(key) ?? { members: new Map(), defaultKeys: [] };

		for (const name of shape.exportNames) {
			entry.members.set(name, typed.get(name) ?? entry.members.get(name) ?? 'any');
		}

		entry.defaultKeys = [...new Set([...entry.defaultKeys, ...shape.defaultKeys])];
		modules.set(key, entry);
	}

	return modules;
}

/** Every lookup target exposing each prop: a module key, or `<key>#default` for its object default export. */
function collectProps(modules: Map<string, ModuleEntry>): Map<string, Set<string>> {
	const props = new Map<string, Set<string>>();

	function add(prop: string, target: string) {
		props.set(prop, (props.get(prop) ?? new Set()).add(target));
	}

	for (const [key, { members, defaultKeys }] of modules) {
		for (const name of members.keys()) add(name, key);

		for (const name of defaultKeys) add(name, defaultTarget(key));
	}

	return props;
}

// `findByName` matches a default export's runtime `name`. A memo or forwardRef object has none, so only plain
// functions and classes count.
function collectNames(input: ModuleIndexInput): Map<string, Set<string>> {
	const byName = new Map<string, Set<string>>();

	function add(name: string, type: string) {
		if (/^[A-Za-z_$][\w$]*$/.test(name)) {
			byName.set(name, (byName.get(name) ?? new Set()).add(type));
		}
	}

	for (const { exportName, component } of input.exports) {
		if (
			exportName === 'default' &&
			(component.kind === 'function' || component.kind === 'class')
		) {
			const type = `${input.names.get(component)}Component`;

			if (input.typed.has(type)) {
				add(component.name, type);
			}
		}
	}

	return byName;
}

function defaultTarget(key: string): string {
	return `${key}#default`;
}

function isTyped(entry: ModuleEntry): boolean {
	return [...entry.members.values()].some((type) => type !== 'any');
}

function moduleLines(modules: Map<string, ModuleEntry>): string[] {
	return [...modules]
		.sort(([a], [b]) => compare(a, b))
		.map(([key, { members }]) => {
			const lines = [...members]
				.sort(([a], [b]) => compare(a, b))
				.map(([name, type]) => `\t\t${propertyKey(name)}: ${type};`);

			return `\t${literalType(key)}: {\n${lines.join('\n')}\n\t};`;
		});
}

/** What the index emits: typed module shapes, their key unions per prop, and every name worth suggesting. */
type ScopedIndex = {
	typed: Map<string, ModuleEntry>;
	props: Map<string, string>;
	names: Set<string>;
	paths: Set<string>;
};

/**
 * Suggests the names and paths of targets a lookup can name unambiguously, with two or more distinctive names. Only
 * those with a typed export get a shape, and a prop resolves only when every target exposing it has one.
 */
function scope(modules: Map<string, ModuleEntry>): ScopedIndex {
	const all = collectProps(modules);
	const distinctive = (name: string) => all.get(name)!.size <= MAX_TARGETS;
	const qualifies = (names: Iterable<string>) =>
		[...names].filter(distinctive).length >= MIN_DISTINCTIVE;
	const typed = new Map<string, ModuleEntry>();
	const names = new Set<string>();
	const paths = new Set<string>();

	for (const [key, entry] of modules) {
		const exports = qualifies(entry.members.keys());
		const defaults = qualifies(entry.defaultKeys);

		for (const name of exports ? entry.members.keys() : []) names.add(name);

		for (const name of defaults ? entry.defaultKeys : []) names.add(name);

		if ((exports || defaults) && !key.startsWith('~')) {
			paths.add(key);
		}

		if (exports && isTyped(entry)) {
			typed.set(key, { ...entry, defaultKeys: [] });
		}
	}

	const props = new Map<string, string>();

	for (const [prop, exposing] of all) {
		const indexed = [...exposing].filter((target) => typed.has(target));

		if (indexed.length === 0) {
			continue;
		}

		if (!distinctive(prop)) {
			props.set(prop, 'string');
		} else if (indexed.length === exposing.size) {
			props.set(prop, union(indexed.map(literalType)));
		}
	}

	return { typed, props, names, paths };
}

function union(values: Iterable<string>): string {
	return [...values].sort(compare).join(' | ');
}

function objectType(entries: Map<string, string>): string {
	const lines = [...entries]
		.sort(([a], [b]) => compare(a, b))
		.map(([key, type]) => `\t${propertyKey(key)}: ${type};`);

	return `{\n${lines.join('\n')}\n}`;
}

/**
 * @description Prints the type-level index of the build's modules that types Metro lookups: each module's exports,
 * an inverted index from prop name to the modules exposing it, and default exports by runtime name.
 * @param input The build's module shapes, its exported components and their type names.
 * @returns The text of {@link MODULE_INDEX_FILE}.
 */
export function emitModuleIndex(input: ModuleIndexInput): string {
	const { typed: modules, props, names, paths } = scope(collectModules(input));
	const byName = new Map([...collectNames(input)].map(([name, types]) => [name, union(types)]));
	const used = new Set<string>();

	for (const type of [...modules.values()].flatMap(({ members }) => [...members.values()])) {
		if (type !== 'any') {
			used.add(type);
		}
	}

	for (const type of byName.values()) {
		used.add(type);
	}

	const imports =
		used.size > 0
			? [
					`import type { ${[...used].sort(compare).join(', ')} } from '${specifier(BARREL_FILE)}';`,
				]
			: [];

	return [
		BANNER,
		...imports,
		'',
		`/** The decompiled Discord build the module index was generated from. */`,
		`export type DiscordModuleIndexBuild = ${literalType(input.build)};`,
		'',
		'/**',
		` * The ${modules.size} modules of Discord ${input.build} with a typed export, keyed by source path, or by \`~\` and a`,
		' * hash of the export names for a module without one. Their other exports are `any`.',
		' */',
		`export type DiscordModules = {\n${moduleLines(modules).join('\n')}\n};`,
		'',
		'/**',
		` * For each of ${props.size} export names of \`DiscordModules\`, the keys exposing it, or \`string\` for a name more than`,
		` * ${MAX_TARGETS} modules expose. A name another module shares is missing, so its lookups stay loose.`,
		' */',
		`export type DiscordModuleProps = ${objectType(props)};`,
		'',
		`/** The ${names.size} export names suggested for a lookup: those of modules with ${MIN_DISTINCTIVE} or more distinctive ones. */`,
		`export type DiscordExportName = ${names.size > 0 ? union([...names].map(literalType)) : 'never'};`,
		'',
		`/** The source paths of those modules, suggested for \`findByFilePath\`. */`,
		`export type DiscordModulePath = ${paths.size > 0 ? union([...paths].map(literalType)) : 'never'};`,
		'',
		'/** Default-exported design-barrel components by their runtime `name`, the key `findByName` matches. */',
		`export type DiscordModulesByName = ${objectType(byName)};`,
		'',
	].join('\n');
}

export default { MODULE_INDEX_FILE, MAX_TARGETS, MIN_DISTINCTIVE, moduleKey, emitModuleIndex };
