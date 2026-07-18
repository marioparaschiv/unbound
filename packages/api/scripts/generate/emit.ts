import { Project, Node, ModuleDeclarationKind, VariableDeclarationKind } from 'ts-morph';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
	API_SRC,
	INTERNAL_OUT,
	TYPES_INDEX,
	ROOT,
	relativeSpecifier,
	type ModuleEntry,
} from './paths';
import { stripInternal, declaredNames } from './transform';
import { bundle } from './bundle';

/**
 * @description Normalises a `.d.ts` file down to its structural surface: `@internal` already
 * stripped, all comments/JSDoc removed, whitespace collapsed. Used only for hashing so JSDoc and
 * formatting edits never flip the version hash.
 * @param text The formatted file text.
 * @returns The comment-free, whitespace-collapsed declaration text.
 */
export function normalizeForHash(text: string): string {
	const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

	return withoutComments.replace(/\s+/g, ' ').trim();
}

/**
 * @description Builds the root `index.d.ts` as pure re-exports of the top-level capability modules
 * (`export * as <name> from './<name>'`), so the barrel references the already-emitted, already-stripped
 * per-module files instead of re-flattening every declaration. Managers and other `@internal` barrel
 * members are absent because they never appear as `export * as` (they use `export { … }`), so the
 * top-level entry list never includes them.
 * @param entries The emitted module entries; only top-level capability modules are re-exported.
 * @returns The root `index.d.ts` text (unformatted, no banner).
 */
export function buildRoot(entries: ModuleEntry[]): string {
	const lines = entries
		.filter((entry) => entry.topLevel)
		.map((entry) => {
			const specifier = relativeSpecifier(join(API_SRC, 'index.d.ts'), entry.out);
			return `export * as ${entry.name} from '${specifier}';`;
		})
		.sort();

	return `${lines.join('\n')}\n`;
}

/**
 * @description Emits the SDK's `global.d.ts`: the addon-facing ambient globals (`$$DEV$$`,
 * `UnboundNative`, `React`, …) from the `@unbound-app/types` `declare global` block, a re-export of the
 * shared types (so `@unbound-app/api/global` stays their public home even though `_internal.d.ts` is
 * unlisted), and the `UnboundGlobal` interface that types `window.unbound` and the ambient `unbound`
 * const. Shared types are never re-declared here - they are imported from `_internal.d.ts`.
 * @param entries The emitted module entries; only top-level capability modules appear on `unbound.*`.
 * @param utilitiesNames The names the `_internal.d.ts` hoist file declares, re-exported for public access.
 * @returns The `global.d.ts` file text (unformatted, no banner).
 */
export function buildGlobal(entries: ModuleEntry[], utilitiesNames: Set<string>): string {
	const outPath = join(API_SRC, 'global.d.ts');
	const project = new Project({ useInMemoryFileSystem: true });
	const sourceFile = project.createSourceFile('global.d.ts', bundle(TYPES_INDEX, true));

	stripInternal(sourceFile, new Set<string>(), new Set<string>());

	// Keep only the ambient `declare global` block; the named type surface lives in `_internal.d.ts`.
	for (const statement of sourceFile.getStatements()) {
		if (Node.isModuleDeclaration(statement) && statement.hasDeclareKeyword()) continue;
		if (declaredNames(statement).length > 0 || Node.isExportDeclaration(statement)) {
			statement.remove();
		}
	}

	const reexport = sourceFile.addExportDeclaration({
		isTypeOnly: true,
		namedExports: [...utilitiesNames].sort().map((name) => ({ name })),
		moduleSpecifier: relativeSpecifier(outPath, INTERNAL_OUT),
	});

	// Sort ahead of the ambient block kept from the bundle.
	reexport.setOrder(0);

	sourceFile.addInterface({
		isExported: true,
		name: 'UnboundGlobal',
		properties: entries
			.filter((entry) => entry.topLevel)
			.map((entry) => {
				const path = './' + relative(API_SRC, entry.out).split('\\').join('/');
				return { name: entry.name, type: `typeof import('${path}')` };
			}),
	});

	const global = sourceFile.addModule({
		hasDeclareKeyword: true,
		declarationKind: ModuleDeclarationKind.Global,
		name: 'global',
	});

	global.addInterface({
		name: 'Window',
		properties: [{ name: 'unbound', type: 'UnboundGlobal' }],
	});

	global.addVariableStatement({
		declarationKind: VariableDeclarationKind.Const,
		declarations: [{ name: 'unbound', type: "Window['unbound']" }],
	});

	return `${sourceFile.getFullText().trim()}\n`;
}

/**
 * @description Rewrites `packages/api/package.json` with the derived version and the regenerated
 * `exports` map, preserving every other field.
 * @param version The `<client version>-<hash>` string to write.
 * @param entries The emitted module entries used to build the `exports` map.
 */
export function writeManifest(version: string, entries: ModuleEntry[]) {
	const manifestPath = join(ROOT, 'packages', 'api', 'package.json');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

	const exports: Record<string, string> = {
		'.': './src/index.d.ts',
		'./global': './src/global.d.ts',
	};

	for (const entry of entries) {
		if (entry.name === '.') continue;

		const target = './src/' + relative(API_SRC, entry.out).split('\\').join('/');
		exports[`./${entry.name}`] = target;
	}

	const ordered: Record<string, string> = {};
	for (const key of Object.keys(exports).sort()) ordered[key] = exports[key];

	manifest.version = version;
	manifest.exports = ordered;

	writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');
}
