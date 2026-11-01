import { Node, type JSDocableNode } from 'ts-morph';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import {
	ADDITIONAL_SUBPATHS,
	EXCLUDE_SUBPATHS,
	ALIAS_ROOT,
	BARREL,
	API_SRC,
	ENTRY,
	logger,
	type Lifecycle,
	type NamespaceAlias,
	type ModuleEntry,
	type SdkEntries,
} from './paths';
import { isInternal } from './transform';
import { parseSource } from './project';

function docText(node: JSDocableNode): string {
	return node
		.getJsDocs()
		.map((jsDoc) => jsDoc.getInnerText().trim())
		.join('\n');
}

/**
 * @description Resolves a module specifier from a barrel to its source `.ts` file. Handles the `~/`
 * alias (mapped to the client `src/`) and relative specifiers, returning either the flat `<path>.ts`
 * or the folder barrel `<path>/index.ts`, whichever exists.
 * @param specifier The raw module specifier (`~/api/metro`, `./filters`, …).
 * @param fromDir The directory of the barrel the specifier was written in, for relative resolution.
 * @returns The absolute source path, or `undefined` if neither a flat file nor a folder barrel exists.
 */
export function resolveSource(specifier: string, fromDir: string): string | undefined {
	const base = specifier.startsWith('~/')
		? join(ALIAS_ROOT, specifier.slice(2))
		: resolve(fromDir, specifier);

	for (const extension of ['.ts', '.tsx']) {
		if (existsSync(`${base}${extension}`)) {
			return `${base}${extension}`;
		}
	}

	if (existsSync(join(base, 'index.ts'))) {
		return join(base, 'index.ts');
	}

	return void 0;
}

/**
 * @description Reads a barrel's `export * as <name> from '<specifier>'` re-exports, skipping any tagged
 * `@internal`. This is the single source of truth for the public module surface.
 * @param barrel The absolute path to the barrel file to parse.
 * @returns The namespace name and resolved source for each surviving re-export.
 */
export function readNamespaceExports(barrel: string): { name: string; source: string }[] {
	const sourceFile = parseSource('barrel.ts', readFileSync(barrel, 'utf8'));
	const fromDir = dirname(barrel);

	const namespaces: { name: string; source: string }[] = [];

	for (const declaration of sourceFile.getExportDeclarations()) {
		const alias = declaration.getNamespaceExport();

		if (!alias) {
			continue;
		}

		if (isInternal(declaration)) {
			continue;
		}

		const name = alias.getName();

		if (!name) {
			continue;
		}

		const specifier = declaration.getModuleSpecifierValue();

		if (!specifier) {
			continue;
		}

		const source = resolveSource(specifier, fromDir);

		if (!source) {
			continue;
		}

		namespaces.push({ name, source });
	}

	return namespaces;
}

/**
 * @description Builds the ordered entry list by parsing the api barrel and recursing into folder
 * modules for their nested `export * as` sub-namespaces (e.g. `metro/filters`). A module is a folder
 * when its source resolves to an `index.ts`; each nested namespace becomes a `<parent>/<child>`
 * subpath entry. Auto-derived subpaths in `EXCLUDE_SUBPATHS` are skipped; `ADDITIONAL_SUBPATHS`
 * are appended. Stale excludeSubpaths entries are reported; an unresolvable additional subpath fails
 * generation.
 * @returns The root barrel and the module entries, sorted so the output is deterministic across runs.
 */
export function buildEntries(): SdkEntries {
	const entries: ModuleEntry[] = [];
	const unusedExcludes = new Set(EXCLUDE_SUBPATHS);

	const outFor = (name: string) => join(API_SRC, ...name.split('/')) + '.d.ts';

	function push(name: string, source: string, topLevel: boolean) {
		const isFolder = source.endsWith('index.ts');
		const out = isFolder ? join(API_SRC, ...name.split('/'), 'index.d.ts') : outFor(name);

		entries.push({ name, source, out, topLevel });

		if (isFolder) {
			walk(source, name, false);
		}
	}

	function walk(barrel: string, prefix: string, topLevel: boolean) {
		for (const { name, source } of readNamespaceExports(barrel)) {
			const subpath = prefix ? `${prefix}/${name}` : name;

			if (EXCLUDE_SUBPATHS.includes(subpath)) {
				unusedExcludes.delete(subpath);
				continue;
			}

			push(subpath, source, topLevel);
		}
	}

	walk(BARREL, '', true);

	for (const extra of ADDITIONAL_SUBPATHS) {
		if (EXCLUDE_SUBPATHS.includes(extra.name)) {
			unusedExcludes.delete(extra.name);
			continue;
		}

		const source = resolveSource(extra.source, dirname(BARREL));

		if (!source) {
			throw new Error(
				`additionalSubpaths entry '${extra.name}' does not resolve: '${extra.source}'.`,
			);
		}

		push(extra.name, source, false);
	}

	if (unusedExcludes.size > 0) {
		logger.warn(
			`excludeSubpaths entries matched no subpath: ${[...unusedExcludes].sort().join(', ')}.`,
		);
	}

	entries.sort((a, b) => a.name.localeCompare(b.name));

	return {
		root: { source: BARREL, out: join(API_SRC, 'index.d.ts') },
		modules: entries,
		aliases: readNamespaceAliases(BARREL),
	};
}

/**
 * @description Reads a barrel's `export const old = Next;` aliases, where `Next` is an `import * as`
 * of a module the barrel also exports with `export * as next`, so the SDK can declare the old name.
 * @param barrel The absolute path to the barrel file to parse.
 * @returns Each alias with the module name it points at and its JSDoc body, sorted by name.
 */
export function readNamespaceAliases(barrel: string): NamespaceAlias[] {
	const sourceFile = parseSource('barrel.ts', readFileSync(barrel, 'utf8'));
	const specifierOf = new Map<string, string>();
	const moduleOf = new Map<string, string>();

	for (const declaration of sourceFile.getImportDeclarations()) {
		const namespace = declaration.getNamespaceImport();

		if (namespace) {
			specifierOf.set(namespace.getText(), declaration.getModuleSpecifierValue());
		}
	}

	for (const declaration of sourceFile.getExportDeclarations()) {
		const alias = declaration.getNamespaceExport()?.getName();
		const specifier = declaration.getModuleSpecifierValue();

		if (alias && specifier) {
			moduleOf.set(specifier, alias);
		}
	}

	const aliases: NamespaceAlias[] = [];

	for (const statement of sourceFile.getVariableStatements()) {
		if (!statement.isExported()) {
			continue;
		}

		const doc = docText(statement);

		for (const declaration of statement.getDeclarations()) {
			const specifier = specifierOf.get(declaration.getInitializer()?.getText() ?? '');
			const target = specifier ? moduleOf.get(specifier) : undefined;

			if (!target) {
				throw new Error(
					`Barrel export '${declaration.getName()}' must alias an \`export * as\` module.`,
				);
			}

			aliases.push({ name: declaration.getName(), target, doc });
		}
	}

	return aliases.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @description Reads the client's `UnboundLifecycle` type (`{ initialize: typeof initialize; ... }`) and
 * the function each member names, so the SDK types the lifecycle from its source and JSDoc.
 * @param entry The client file that declares the type and assigns `window.unbound`.
 * @returns The type's JSDoc and one member per lifecycle function, in declaration order.
 */
export function readLifecycle(entry: string = ENTRY): Lifecycle {
	const sourceFile = parseSource('entry.ts', readFileSync(entry, 'utf8'));
	const alias = sourceFile.getTypeAliasOrThrow('UnboundLifecycle');
	const literal = alias.getTypeNode();

	if (!Node.isTypeLiteral(literal)) {
		throw new Error(`UnboundLifecycle in '${entry}' must be an object type literal.`);
	}

	const members = literal.getProperties().map((property) => {
		const query = property.getTypeNode();
		const target = Node.isTypeQuery(query) ? query.getExprName().getText() : void 0;
		const fn = target ? sourceFile.getFunction(target) : void 0;
		const returnType = fn?.getReturnTypeNode()?.getText();

		if (!fn || !returnType) {
			throw new Error(
				`UnboundLifecycle.${property.getName()} must be \`typeof <function>\` naming a function with a return type.`,
			);
		}

		return {
			name: property.getName(),
			parameters: fn.getParameters().map((parameter) => ({
				name: parameter.getName(),
				type: parameter.getTypeNode()?.getText() ?? 'unknown',
				optional: parameter.isOptional(),
			})),
			returnType,
			doc: docText(fn),
		};
	});

	return { doc: docText(alias), members };
}
