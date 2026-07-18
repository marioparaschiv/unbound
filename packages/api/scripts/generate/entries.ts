import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { Project } from 'ts-morph';

import { ALIAS_ROOT, BARREL, API_SRC, type ModuleEntry } from './paths';
import { config } from '../../sdk.config.ts';
import { isInternal } from './transform';

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

	if (existsSync(`${base}.ts`)) return `${base}.ts`;
	if (existsSync(join(base, 'index.ts'))) return join(base, 'index.ts');

	return void 0;
}

/**
 * @description Reads a barrel's `export * as <name> from '<specifier>'` re-exports, skipping any tagged
 * `@internal`. This is the single source of truth for the public module surface - the managers line
 * uses `export { … }` (not `export * as`) and is excluded automatically.
 * @param barrel The absolute path to the barrel file to parse.
 * @returns The namespace name and resolved source for each surviving re-export.
 */
export function readNamespaceExports(barrel: string): { name: string; source: string }[] {
	const project = new Project({ useInMemoryFileSystem: true });
	const sourceFile = project.createSourceFile('barrel.ts', readFileSync(barrel, 'utf8'));
	const fromDir = dirname(barrel);

	const namespaces: { name: string; source: string }[] = [];

	for (const declaration of sourceFile.getExportDeclarations()) {
		const alias = declaration.getNamespaceExport();
		if (!alias) continue;
		if (isInternal(declaration)) continue;

		const name = alias.getName();
		if (!name) continue;

		const specifier = declaration.getModuleSpecifierValue();
		if (!specifier) continue;

		const source = resolveSource(specifier, fromDir);
		if (!source) continue;

		namespaces.push({ name, source });
	}

	return namespaces;
}

/**
 * @description Builds the ordered entry list by parsing the api barrel and recursing into folder
 * modules for their nested `export * as` sub-namespaces (e.g. `metro/filters`). A module is a folder
 * when its source resolves to an `index.ts`; each nested namespace becomes a `<parent>/<child>`
 * subpath entry. Auto-derived subpaths in `config.excludeSubpaths` are skipped; `config.additionalSubpaths`
 * are appended.
 * @returns The entry descriptors (root first) sorted so the output is deterministic across runs.
 */
export function buildEntries(): ModuleEntry[] {
	const entries: ModuleEntry[] = [];

	const outFor = (name: string) => join(API_SRC, ...name.split('/')) + '.d.ts';

	function walk(barrel: string, prefix: string, topLevel: boolean) {
		for (const { name, source } of readNamespaceExports(barrel)) {
			const subpath = prefix ? `${prefix}/${name}` : name;
			if (config.excludeSubpaths.includes(subpath)) continue;

			const isFolder = source.endsWith('index.ts');
			const out = isFolder
				? join(API_SRC, ...subpath.split('/'), 'index.d.ts')
				: outFor(subpath);

			entries.push({ name: subpath, source, out, topLevel });

			if (isFolder) walk(source, subpath, false);
		}
	}

	walk(BARREL, '', true);

	for (const extra of config.additionalSubpaths) {
		const source = resolve(dirname(BARREL), extra.source);
		if (config.excludeSubpaths.includes(extra.name)) continue;

		entries.push({ name: extra.name, source, out: outFor(extra.name), topLevel: false });
	}

	const root: ModuleEntry = {
		name: '.',
		source: BARREL,
		out: join(API_SRC, 'index.d.ts'),
		topLevel: false,
	};

	entries.sort((a, b) => a.name.localeCompare(b.name));

	return [root, ...entries.filter((entry) => entry.name !== '.')];
}
