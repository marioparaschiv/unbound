import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { parseSync, Visitor, type ESTree } from '~/rollup/rolldown-utils';
import { LOCALE_MODULE } from '~/rollup/locales';

/** One place a plugin's source names a message key. */
export type KeyUsage = { key: string; file: string; line: number; site: string };

/** A key site whose key is computed, so `ubd i18n unused` cannot tell which key it reads. */
export type DynamicUsage = { file: string; line: number; site: string };

/** Every key a plugin's source names, and what the collector could not read. */
export type KeyUsages = {
	usages: KeyUsage[];
	dynamic: DynamicUsage[];
	failures: { file: string; error: string }[];
};

/** A call whose arguments hold message keys. */
export type KeySite = {
	/** How the call reads in source, as the report and the docs name it. */
	site: string;
	/** `module#export` for an imported function, `object.method` for a method on an object named so. */
	callees: readonly string[];
	/** Whether a string first argument is a key. */
	firstArgument?: boolean;
	/** Property names whose string values, at any depth of the arguments, are keys. */
	properties?: readonly string[];
	/** Whether every property value of an object first argument is a key, as in `option.choice({ heads: 'KEY' })`. */
	firstArgumentValues?: boolean;
};

/** Every call that takes message keys. A new call site is one more row. */
export const KEY_SITES: readonly KeySite[] = [
	{ site: "format('KEY', …)", callees: [`${LOCALE_MODULE}#format`], firstArgument: true },
	{
		site: 'defineSettings({ title, subtitle, placeholder, options, confirm })',
		callees: ['@unbound-app/settings/schema#defineSettings'],
		properties: ['title', 'subtitle', 'placeholder', 'label', 'options', 'confirm'],
	},
	{
		site: 'commands.register({ description, label })',
		callees: ['commands.register'],
		properties: ['description', 'label'],
	},
	{
		site: "option.choice({ value: 'KEY' })",
		callees: ['option.choice'],
		firstArgumentValues: true,
	},
	{
		site: "toasts.success('KEY', vars)",
		callees: ['toasts.success', 'toasts.error', 'toasts.info', 'toasts.warning'],
		firstArgument: true,
	},
	{
		site: "dialogs.confirm('KEY', { body, confirm, cancel })",
		callees: ['dialogs.confirm', 'dialogs.alert'],
		firstArgument: true,
		properties: ['body', 'confirm', 'cancel'],
	},
];

/** Exports whose properties are keys: `messages.KEY` and `messages['KEY']`. */
export const KEY_OBJECTS: readonly string[] = [`${LOCALE_MODULE}#messages`];

const MESSAGES_SITE = 'messages.KEY';

const LANGS: Record<string, 'js' | 'jsx' | 'ts' | 'tsx'> = {
	'.js': 'jsx',
	'.jsx': 'jsx',
	'.mjs': 'jsx',
	'.ts': 'ts',
	'.mts': 'ts',
	'.tsx': 'tsx',
};

const SITES = new Map(KEY_SITES.flatMap((site) => site.callees.map((callee) => [callee, site])));

type Imports = { named: Map<string, string>; namespaces: Map<string, string> };

type Collect = (key: string, node: ESTree.Node, site: string) => void;

// A key found at a source offset; a computed read has no key.
type Positioned = { start: number; key: string; site: string };

// UNKNOWN: walking every key of an AST node reaches values of every shape.
function isNode(value: unknown): value is ESTree.Node {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		typeof value.type === 'string'
	);
}

// `parent` points back up the tree, so it is skipped to keep the walk finite.
function children(node: ESTree.Node): ESTree.Node[] {
	return Object.entries(node).flatMap(([key, value]) => {
		if (key === 'parent') {
			return [];
		}

		return (Array.isArray(value) ? value : [value]).filter((item) => isNode(item));
	});
}

function readImports(program: ESTree.Program): Imports {
	const imports: Imports = { named: new Map(), namespaces: new Map() };

	for (const statement of program.body) {
		if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type') {
			continue;
		}

		for (const specifier of statement.specifiers) {
			if (specifier.type === 'ImportNamespaceSpecifier') {
				imports.namespaces.set(specifier.local.name, statement.source.value);
			} else if (specifier.type === 'ImportSpecifier' && specifier.importKind !== 'type') {
				const imported =
					specifier.imported.type === 'Identifier'
						? specifier.imported.name
						: specifier.imported.value;

				imports.named.set(specifier.local.name, `${statement.source.value}#${imported}`);
			}
		}
	}

	return imports;
}

function lastName(node: ESTree.Node): string | undefined {
	if (node.type === 'Identifier') {
		return node.name;
	}

	if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
		return node.property.name;
	}

	return undefined;
}

// Names an expression as the site table spells it: `module#export` when imported, `object.member` otherwise.
function qualify(node: ESTree.Node, imports: Imports): string | undefined {
	if (node.type === 'Identifier') {
		return imports.named.get(node.name) ?? node.name;
	}

	if (node.type !== 'MemberExpression' || node.computed || node.property.type !== 'Identifier') {
		return undefined;
	}

	const namespace =
		node.object.type === 'Identifier' ? imports.namespaces.get(node.object.name) : void 0;

	if (namespace) {
		return `${namespace}#${node.property.name}`;
	}

	const owner = lastName(node.object);

	return owner && `${owner}.${node.property.name}`;
}

// The strings a value can be: a literal, a template without expressions, both arms of `?:`, or a list of them.
function stringsOf(node: ESTree.Node): ESTree.Node[] {
	switch (node.type) {
		case 'Literal':
			return typeof node.value === 'string' ? [node] : [];
		case 'TemplateLiteral':
			return node.expressions.length === 0 ? [node] : [];
		case 'ConditionalExpression':
			return [...stringsOf(node.consequent), ...stringsOf(node.alternate)];
		case 'ArrayExpression':
			return node.elements.flatMap((element) => (element ? stringsOf(element) : []));
		case 'TSAsExpression':
		case 'TSSatisfiesExpression':
			return stringsOf(node.expression);
		default:
			return [];
	}
}

function stringValue(node: ESTree.Node): string {
	if (node.type === 'Literal' && typeof node.value === 'string') {
		return node.value;
	}

	return node.type === 'TemplateLiteral' ? (node.quasis[0]?.value.cooked ?? '') : '';
}

function propertyName(node: ESTree.Node): string | undefined {
	if (node.type === 'Identifier') {
		return node.name;
	}

	return node.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;
}

// Function bodies are skipped: a callback's own objects are not the site's configuration.
function collectProperties(
	node: ESTree.Node,
	names: ReadonlySet<string>,
	site: string,
	collect: Collect,
): void {
	if (
		node.type === 'FunctionExpression' ||
		node.type === 'ArrowFunctionExpression' ||
		node.type === 'FunctionDeclaration'
	) {
		return;
	}

	if (node.type === 'Property' && !node.computed) {
		const name = propertyName(node.key);

		if (name && names.has(name)) {
			for (const literal of stringsOf(node.value))
				collect(stringValue(literal), literal, site);

			// An option map, `{ eu: 'REGION_EU' }`: each bare value is a key; an object value's `title` is found below.
			if (node.value.type === 'ObjectExpression') {
				for (const option of node.value.properties) {
					if (option.type !== 'Property') {
						continue;
					}

					for (const literal of stringsOf(option.value))
						collect(stringValue(literal), literal, site);
				}
			}
		}
	}

	for (const child of children(node)) collectProperties(child, names, site, collect);
}

function collectCall(
	node: ESTree.CallExpression,
	site: KeySite,
	collect: Collect,
	dynamic: (node: ESTree.Node, site: string) => void,
): void {
	const [first] = node.arguments;

	if (site.firstArgument && first && first.type !== 'ObjectExpression') {
		const literals = stringsOf(first);

		for (const literal of literals) collect(stringValue(literal), literal, site.site);

		if (literals.length === 0) {
			dynamic(first, site.site);
		}
	}

	if (site.firstArgumentValues && first?.type === 'ObjectExpression') {
		for (const property of first.properties) {
			if (property.type !== 'Property') {
				continue;
			}

			for (const literal of stringsOf(property.value)) {
				collect(stringValue(literal), literal, site.site);
			}
		}
	}

	if (!site.properties) return;

	const names = new Set(site.properties);

	for (const argument of node.arguments) collectProperties(argument, names, site.site, collect);
}

/**
 * @description Collects the message keys one module names, by the {@link KEY_SITES} and {@link KEY_OBJECTS} tables.
 * @param file The module's path relative to the plugin, as the usages report it.
 * @param code The module's source.
 * @returns The keys it names, and its computed key reads; throws when the module does not parse.
 */
export function collectModuleKeys(file: string, code: string): Omit<KeyUsages, 'failures'> {
	const parsed = parseSync(file, code, {
		lang: LANGS[extname(file)] ?? 'tsx',
		sourceType: 'module',
	});
	const firstError = parsed.errors[0];

	if (firstError) {
		throw new Error(firstError.message);
	}

	const imports = readImports(parsed.program);
	const found: Positioned[] = [];
	const dynamicReads: Positioned[] = [];
	const collect: Collect = (key, node, site) => found.push({ start: node.start, key, site });
	const dynamic = (node: ESTree.Node, site: string) =>
		dynamicReads.push({ start: node.start, key: '', site });

	new Visitor({
		CallExpression(node) {
			const callee = qualify(node.callee, imports);
			const site = callee === undefined ? undefined : SITES.get(callee);

			if (site) {
				collectCall(node, site, collect, dynamic);
			}
		},
		MemberExpression(node) {
			const owner = qualify(node.object, imports);

			if (owner === undefined || !KEY_OBJECTS.includes(owner)) return;

			if (!node.computed && node.property.type === 'Identifier') {
				collect(node.property.name, node.property, MESSAGES_SITE);
			} else if (node.computed && stringsOf(node.property).length) {
				for (const literal of stringsOf(node.property)) {
					collect(stringValue(literal), literal, MESSAGES_SITE);
				}
			} else {
				dynamic(node.property, MESSAGES_SITE);
			}
		},
	}).visit(parsed.program);

	const lineOf = (start: number) => code.slice(0, start).split('\n').length;
	const bySource = (left: Positioned, right: Positioned) => left.start - right.start;

	// Settings visit a list before the objects in it, so usages are put back in source order.
	return {
		usages: found
			.sort(bySource)
			.map(({ start, key, site }) => ({ key, file, line: lineOf(start), site })),
		dynamic: dynamicReads
			.sort(bySource)
			.map(({ start, site }) => ({ file, line: lineOf(start), site })),
	};
}

function listSources(pluginRoot: string): string[] {
	const sourceDir = join(pluginRoot, 'src');
	const inSrc = existsSync(sourceDir)
		? readdirSync(sourceDir, { recursive: true, encoding: 'utf8' }).map((path) =>
				join('src', path),
			)
		: [];
	const rootSettings = ['settings.ts', 'settings.tsx'].filter((name) =>
		existsSync(join(pluginRoot, name)),
	);

	return [...inSrc, ...rootSettings]
		.filter((path) => extname(path) in LANGS && !path.endsWith('.d.ts'))
		.filter((path) => !path.split(/[\\/]/).includes('node_modules'))
		.sort();
}

/**
 * @description Collects every message key a plugin's `src/` and root `settings.ts` name, module by module.
 * @param pluginRoot The plugin's directory.
 * @returns The keys, the computed key reads, and each module that failed to parse.
 */
export function collectPluginKeys(pluginRoot: string): KeyUsages {
	const found: KeyUsages = { usages: [], dynamic: [], failures: [] };

	for (const path of listSources(pluginRoot)) {
		const file = relative(pluginRoot, join(pluginRoot, path));

		try {
			const module = collectModuleKeys(file, readFileSync(join(pluginRoot, path), 'utf8'));

			found.usages.push(...module.usages);
			found.dynamic.push(...module.dynamic);
		} catch (error) {
			found.failures.push({ file, error: (error as Error).message });
		}
	}

	return found;
}
