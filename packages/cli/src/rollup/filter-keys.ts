import type { Plugin, RenderedChunk } from 'rollup';
import { parseAst } from 'rolldown/parseAst';
import type { ESTree } from 'rolldown/utils';
import MagicString from 'magic-string';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import type { IdentifierNode, Node, Scopes } from './filter-scope.ts';
import type { Canonicalized } from './filter-canonical.ts';
import type { PredicateNames } from './filter-raise.ts';
import type { HashContext } from './filter-hash.ts';

import { canonicalize, describeCanonical, renderCanonical } from './filter-canonical.ts';
import { analyzeScopes, isFunction, walk } from './filter-scope.ts';
import { hashFunction, resolveExpression } from './filter-hash.ts';
import { reportProblem } from './diagnostic.ts';
import { readBuildEnv } from './build-env.ts';
import { reportLine } from './report-line.ts';

const API = '@unbound-app/api';

/** The `ubd check` id this plugin reports under. */
export const CHECK = 'filters';

type Position = 'first' | 'factory' | 'every' | 'items';

// Which arguments of each metro API are filters: the first, every one, or each bulk item's `filter`.
const FILTER_ARGUMENTS: Record<string, Position> = {
	'metro.find': 'first',
	'metro.findLazy': 'first',
	'metro.onModuleLoaded': 'first',
	'metro.filter': 'factory',
	'metro.filters.all': 'every',
	'metro.filters.any': 'every',
	'metro.filters.not': 'first',
	'metro.bulk': 'items',
};

type FilterSite = {
	argument: Node;
	call: ESTree.CallExpression;
	factory: boolean;
	namespace?: string;
};

type ApiPath = { root: string; rootPath: string; path: string };

type ModuleRange = { start: number; end: number; id: string };

function parse(code: string, filename?: string): ESTree.Program {
	return parseAst(code, { lang: filename ? void 0 : 'js', preserveParens: false }, filename);
}

/**
 * @description Gives every filter a plugin passes to a metro search a cache key derived from its source, so equal filters in any plugin share one persisted cache entry.
 * A predicate equal to built-in filters becomes those built-ins; one that reads an outside variable fails the build.
 * Runs on the bundled chunk, where an imported or aliased predicate resolves to its definition, before minify renames anything.
 * @param pluginRoot The plugin's directory, which diagnostics name files relative to.
 * @returns The rollup plugin.
 */
export function filterKeys(pluginRoot: string): Plugin {
	return {
		name: 'unbound-filter-keys',
		renderChunk(code, chunk) {
			const program = parse(code);
			const scopes = analyzeScopes(program);
			const sites = collectSites(program, scopes);

			if (!sites.length) return null;

			const locate = moduleLocator(program, chunk);
			const context: HashContext = { scopes, memo: new Map(), stack: [] };
			const output = new MagicString(code);
			const { verbose } = readBuildEnv();
			let edited = false;

			for (const site of sites) {
				const { argument, call } = site;
				const file = locate(call.start);
				const resolved = resolveExpression(argument, scopes);

				if (resolved.kind === 'runtime') {
					this.emitFile(
						reportLine({ section: 'metro', label: 'filters', tally: 'keyed' }),
					);
					continue;
				}

				if (resolved.kind === 'dynamic') {
					this.emitFile(
						reportLine({
							section: 'metro',
							label: 'filters',
							tally: 'uncached',
							location: relative(pluginRoot, file),
							issue: 'uncached filter',
						}),
					);
					reportProblem(this, CHECK, pluginRoot, {
						file,
						severity: 'warning',
						message: `\`${describeCall(call)}\` gets a filter ${resolved.reason}, so it searches uncached`,
						fix: 'define the predicate where the build can trace it, such as a `const` or an import',
					});
					continue;
				}

				const result = hashFunction(resolved.node, context);

				if ('captured' in result) {
					reportProblem(this, CHECK, pluginRoot, {
						file,
						severity: 'error',
						message: `The metro filter in \`${describeCall(call)}\` reads \`${result.captured}\` from outside the function, so no cache key can describe it`,
						fix: `pass \`${result.captured}\` as an argument: metro.filter((m, ${result.captured}) => …)(${result.captured})`,
					});

					continue;
				}

				const rewrite: Canonicalized | undefined =
					site.factory || !site.namespace
						? void 0
						: canonicalize(resolved.node, scopes, code);

				edited = true;
				this.emitFile(reportLine({ section: 'metro', label: 'filters', tally: 'keyed' }));

				if (rewrite && 'hint' in rewrite) {
					reportProblem(this, CHECK, pluginRoot, {
						file,
						severity: 'warning',
						message: rewrite.hint,
					});
				}

				if (rewrite && 'canonical' in rewrite && site.namespace) {
					const text = renderCanonical(rewrite.canonical, site.namespace, (source) =>
						keyed(`(${source})`, residualKey(source)),
					);

					output.overwrite(argument.start, argument.end, text);

					if (verbose) {
						const definedIn = locate(resolved.node.start);

						this.info(
							`${relative(pluginRoot, definedIn)}:${lineOf(definedIn, rewrite.names)}  ${rewrite.predicate} → ${describeCanonical(rewrite.canonical)}`,
						);
					}

					continue;
				}

				output.prependRight(argument.start, 'Object.assign(');
				output.appendLeft(argument.end, keySuffix(result.hash));
			}

			if (!edited) return null;

			return { code: output.toString(), map: output.generateMap({ hires: true }) };
		},
	};
}

function keySuffix(hash: string) {
	return `, { [Symbol.for("metro.cache")]: "custom::${hash}" })`;
}

function keyed(expression: string, hash: string) {
	return `Object.assign(${expression}${keySuffix(hash)}`;
}

// A residual predicate stands alone: it reads only its parameter, swc's temps and globals.
function residualKey(source: string): string {
	const program = parse(`(${source});`);
	const [statement] = program.body;
	const fn = statement?.type === 'ExpressionStatement' ? statement.expression : void 0;

	if (!fn || !isFunction(fn)) {
		throw new Error(`Failed to parse the residual metro filter ${source}.`);
	}

	const result = hashFunction(fn, { scopes: analyzeScopes(program), memo: new Map(), stack: [] });

	if (!('hash' in result)) {
		throw new Error(
			`Failed to key the residual metro filter ${source}: it reads \`${result.captured}\`.`,
		);
	}

	return result.hash;
}

function bulkFilters(item: Node): Node[] {
	if (item.type !== 'ObjectExpression') {
		return [];
	}

	const filters: Node[] = [];

	for (const property of item.properties) {
		if (
			property.type === 'Property' &&
			!property.computed &&
			property.key.type === 'Identifier' &&
			property.key.name === 'filter'
		) {
			filters.push(property.value);
		}
	}

	return filters;
}

function filterArguments(call: ESTree.CallExpression, position: Position): Node[] {
	switch (position) {
		case 'every':
			return call.arguments.filter((argument) => argument.type !== 'SpreadElement');
		case 'items':
			return call.arguments.flatMap(bulkFilters);
		default:
			return call.arguments.slice(0, 1);
	}
}

function collectSites(program: ESTree.Program, scopes: Scopes): FilterSite[] {
	const sites: FilterSite[] = [];
	const shadowsUnbound = [...scopes.bindingOf.values()].some(
		(binding) => binding?.name === 'unbound',
	);

	walk(program, (call) => {
		if (call.type !== 'CallExpression') return;

		const api = apiPath(call.callee, scopes);
		const position = api && FILTER_ARGUMENTS[api.path];

		if (!api || !position) return;

		const namespace = filtersNamespace(api, shadowsUnbound);

		for (const argument of filterArguments(call, position)) {
			sites.push({ argument, call, factory: position === 'factory', namespace });
		}
	});

	return sites;
}

function memberName(node: ESTree.MemberExpression): string | undefined {
	const { property } = node;

	if (!node.computed) {
		return property.type === 'Identifier' ? property.name : void 0;
	}

	return property.type === 'Literal' && typeof property.value === 'string'
		? property.value
		: void 0;
}

// `metro.filters.all` from `import { metro } from '@unbound-app/api'`, a subpath import, or the scoped `unbound` global.
function apiPath(callee: Node, scopes: Scopes): ApiPath | undefined {
	const properties: string[] = [];
	let node: Node | undefined =
		callee.type === 'SequenceExpression' ? callee.expressions.at(-1) : callee;

	while (node?.type === 'MemberExpression') {
		const property = memberName(node);

		if (!property) {
			return void 0;
		}

		properties.unshift(property);
		node = node.object;
	}

	if (node?.type !== 'Identifier') {
		return void 0;
	}

	const rootPath = importedPath(scopes, node);

	if (rootPath === void 0) {
		return void 0;
	}

	return { root: node.name, rootPath, path: [rootPath, ...properties].filter(Boolean).join('.') };
}

function importedPath(scopes: Scopes, identifier: IdentifierNode) {
	const binding = scopes.bindingOf.get(identifier);

	if (!binding) {
		return identifier.name === 'unbound' ? '' : void 0;
	}

	const { source, imported } = binding;

	if (binding.kind !== 'import' || !source || imported === 'default') {
		return void 0;
	}

	if (source !== API && !source.startsWith(`${API}/`)) {
		return void 0;
	}

	const prefix = source.slice(API.length + 1).replaceAll('/', '.');

	return [prefix, imported].filter(Boolean).join('.');
}

// The code naming `metro.filters` at the call, so a rewrite reads the built-ins the same way the call reads its API.
function filtersNamespace(api: ApiPath, shadowsUnbound: boolean): string | undefined {
	const target = ['metro', 'filters'];
	const root = api.rootPath ? api.rootPath.split('.') : [];

	if (root.every((part, index) => target[index] === part)) {
		return [api.root, ...target.slice(root.length)].join('.');
	}

	return shadowsUnbound ? void 0 : ['unbound', ...target].join('.');
}

// Names a call the way its author wrote it, such as `metro.find(predicate)`.
function describeCall(call: ESTree.CallExpression): string {
	return `${describe(call.callee)}(${call.arguments.map(describe).join(', ')})`;
}

function describe(node: Node): string {
	switch (node.type) {
		case 'Identifier':
			return node.name;
		case 'MemberExpression':
			return `${describe(node.object)}${node.computed ? '[…]' : `.${memberName(node)}`}`;
		case 'CallExpression':
			return describeCall(node);
		case 'Literal':
			return typeof node.value === 'string' ? JSON.stringify(node.value) : String(node.value);
		case 'ObjectExpression':
			return '{…}';
		default:
			return isFunction(node) ? 'function' : '…';
	}
}

// Rollup writes each module's statements in order between the chunk's imports and exports, which maps a position back to its file.
function moduleLocator(program: ESTree.Program, chunk: RenderedChunk) {
	let ranges: ModuleRange[] | undefined;

	function build() {
		const statements = program.body.filter(
			(statement) => statement.type !== 'ImportDeclaration',
		);
		const built: ModuleRange[] = [];
		let index = 0;

		for (const [id, rendered] of Object.entries(chunk.modules)) {
			if (!rendered.code) {
				continue;
			}

			const count = parse(rendered.code).body.length;
			const first = statements[index];
			const last = statements[index + count - 1];

			if (count && first && last) {
				built.push({ start: first.start, end: last.end, id });
			}

			index += count;
		}

		return built;
	}

	return (position: number) => {
		ranges ??= build();

		const id = ranges.find((range) => position >= range.start && position < range.end)?.id;

		return id ?? chunk.fileName;
	};
}

function namesUnder(node: Node): PredicateNames {
	const strings: string[] = [];
	const properties: string[] = [];

	walk(node, (inner) => {
		if (inner.type === 'Literal' && typeof inner.value === 'string') {
			strings.push(inner.value);
		}

		if (inner.type !== 'MemberExpression' || inner.computed) return;

		const name = memberName(inner);

		if (name) {
			properties.push(name);
		}
	});

	return { strings, properties };
}

// swc reflows the source, so the line is that of the smallest function in the file reading all the predicate's names.
function lineOf(file: string, names: PredicateNames) {
	let source: string;

	try {
		source = readFileSync(file, 'utf8');
	} catch {
		// A virtual module has no file to read.
		return '?';
	}

	let best: Node | undefined;

	walk(parse(source, file), (node) => {
		if (!isFunction(node) || (best && node.end - node.start >= best.end - best.start)) return;

		const found = namesUnder(node);
		const hasAll =
			names.strings.every((name) => found.strings.includes(name)) &&
			names.properties.every((name) => found.properties.includes(name));

		if (hasAll) {
			best = node;
		}
	});

	if (!best) {
		return '?';
	}

	let line = 1;

	for (let index = 0; index < best.start; index++) {
		if (source.charCodeAt(index) === 10) {
			line++;
		}
	}

	return line;
}

export default filterKeys;
