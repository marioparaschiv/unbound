import { Node, ModuleDeclarationKind, VariableDeclarationKind, ts } from 'ts-morph';
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
	API_SRC,
	INTERNAL_OUT,
	TYPES_INDEX,
	ROOT,
	readJson,
	relativeSpecifier,
	type ModuleEntry,
} from './paths';
import { stripInternal, declaredNames, collectReferencedNames } from './transform';
import { parseSource } from './project';
import { bundle } from './bundle';

/**
 * @description Normalises a `.d.ts` file down to its structural surface for hashing: the text is
 * reprinted through the TypeScript printer with comments removed, so JSDoc and formatting edits
 * never flip the version hash while string literals (which may contain `//`) survive untouched.
 * @param text The formatted file text.
 * @returns The comment-free, canonically printed declaration text.
 */
export function normalizeForHash(text: string): string {
	const sourceFile = ts.createSourceFile(
		'hash.d.ts',
		text,
		ts.ScriptTarget.Latest,
		false,
		ts.ScriptKind.TS,
	);

	return ts.createPrinter({ removeComments: true }).printFile(sourceFile);
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
 * @param internalExports The names the `_internal.d.ts` hoist file exports, re-exported for public access.
 * @param ownerByName The map attributing each hoisted declaration name to its owning hoist file, used
 * to import names the ambient block references.
 * @returns The `global.d.ts` file text (unformatted, no banner).
 */
export function buildGlobal(
	entries: ModuleEntry[],
	internalExports: Set<string>,
	ownerByName: Map<string, string>,
): string {
	const outPath = join(API_SRC, 'global.d.ts');
	const sourceFile = parseSource('global.d.ts', bundle(TYPES_INDEX, true));

	stripInternal(sourceFile, new Set<string>(), new Set<string>());

	// Keep only the ambient `declare global` blocks and the imports that may feed them; the named
	// type surface lives in `_internal.d.ts`.
	for (const statement of sourceFile.getStatements()) {
		if (Node.isModuleDeclaration(statement) && statement.hasDeclareKeyword()) continue;
		if (Node.isImportDeclaration(statement)) continue;

		if (declaredNames(statement).length > 0 || Node.isExportDeclaration(statement)) {
			statement.remove();
		}
	}

	const ambient = sourceFile.getStatements().filter(Node.isModuleDeclaration);

	const referenced = collectReferencedNames(ambient);
	const declaredInAmbient = new Set<string>();

	for (const statement of ambient) {
		const body = statement.getBody();
		if (!body || !Node.isStatemented(body)) continue;

		for (const inner of body.getStatements()) {
			for (const name of declaredNames(inner)) declaredInAmbient.add(name);
		}
	}

	// A re-export creates no local binding, so every name the ambient block references must resolve
	// through a real import or a local declaration. Existing imports are pruned to the referenced
	// names; names owned by a hoist file are imported from their owner; anything left resolves
	// ambiently (TypeScript lib globals such as `Promise`).
	const bound = new Set<string>();

	for (const statement of sourceFile.getStatements()) {
		if (!Node.isImportDeclaration(statement)) continue;

		const defaultImport = statement.getDefaultImport();
		if (defaultImport) {
			if (referenced.has(defaultImport.getText())) bound.add(defaultImport.getText());
			else statement.removeDefaultImport();
		}

		for (const specifier of statement.getNamedImports()) {
			const local = specifier.getAliasNode()?.getText() ?? specifier.getName();
			if (referenced.has(local)) bound.add(local);
			else specifier.remove();
		}

		if (
			!statement.getDefaultImport() &&
			!statement.getNamespaceImport() &&
			statement.getNamedImports().length === 0
		) {
			statement.remove();
		}
	}

	const importsByOwner = new Map<string, Set<string>>();

	for (const name of referenced) {
		if (declaredInAmbient.has(name) || bound.has(name)) continue;

		const owner = ownerByName.get(name);
		if (owner === void 0) continue;

		const bucket = importsByOwner.get(owner) ?? new Set<string>();
		bucket.add(name);
		importsByOwner.set(owner, bucket);
	}

	for (const [owner, names] of importsByOwner) {
		const specifier = relativeSpecifier(outPath, owner);
		sourceFile.insertStatements(
			0,
			`import type { ${[...names].sort().join(', ')} } from '${specifier}';`,
		);
	}

	const reexport = sourceFile.addExportDeclaration({
		isTypeOnly: true,
		namedExports: [...internalExports].sort().map((name) => ({ name })),
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
	const manifest = readJson(manifestPath);

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
