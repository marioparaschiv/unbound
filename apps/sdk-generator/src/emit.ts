import { Node, ModuleDeclarationKind, VariableDeclarationKind, ts } from 'ts-morph';
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';

import type { Lifecycle, NamespaceAlias, ModuleEntry } from './entry-types';

import { API_MANIFEST, API_SRC, GLOBAL_OUT, INTERNAL_OUT, ROOT_OUT, TYPES_INDEX } from './config';
import { relativeSpecifier, stripInternal, groupByOwner, typeOnlyStatements } from './transform';
import { declaredNames, collectReferencedNames } from './declarations';
import { addonScopeGlobals } from './addon-scope';
import { readLifecycle } from './entries';
import { parseSource } from './project';
import { bundle } from './bundle';
import { readJson } from './json';

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
 * per-module files instead of re-flattening every declaration, then declares the barrel's aliases of
 * those modules.
 * @param entries The emitted module entries; only top-level capability modules are re-exported.
 * @param aliases The barrel's old names for top-level modules, declared after the re-exports.
 * @returns The root `index.d.ts` text (unformatted, no banner).
 */
export function buildRoot(entries: ModuleEntry[], aliases: NamespaceAlias[] = []): string {
	const out = ROOT_OUT;
	const specifierOf = new Map(
		entries
			.filter((entry) => entry.topLevel)
			.map((entry) => [entry.name, relativeSpecifier(out, entry.out)]),
	);
	const lines = [...specifierOf]
		.map(([name, specifier]) => `export * as ${name} from '${specifier}';`)
		.sort();
	const declarations = aliases.map(
		(alias) =>
			`${docComment(alias.doc)}export declare const ${alias.name}: typeof import('${specifierOf.get(alias.target)}');`,
	);

	return `${IMAGE_MODULES_REFERENCE}\n\n${[...lines, ...declarations].join('\n')}\n`;
}

// Types image imports; hand-written outside the generated `src`, and loaded by both the root barrel and the globals.
const IMAGE_MODULES_REFERENCE = '/// <reference path="../ambient/image-modules.d.ts" />';

function docComment(doc: string): string {
	return doc ? `/** ${doc} */\n` : '';
}

/**
 * @description Emits the SDK's `global.d.ts`: the addon-facing ambient globals (`$$DEV$$`,
 * `NativePlugin`, `React`, …) from the `@unbound-app/types` `declare global` block, a re-export of the
 * shared types (so `@unbound-app/api/global` stays their public home even though `_internal.d.ts` is
 * unlisted), `UnboundGlobal` and `UnboundLifecycle`, the live and post-shutdown shapes of `window.unbound`,
 * and the `AddonScope` type with an ambient const per Addon scope global. Shared types are never re-declared here - they are imported from `_internal.d.ts`.
 * @param entries The emitted module entries; only top-level capability modules appear on `unbound.*`.
 * @param internalExports The names the `_internal.d.ts` hoist file exports, re-exported for public access.
 * @param ownerByName The map attributing each hoisted declaration name to its owning hoist file, used
 * to import names the ambient block references.
 * @param aliases The barrel's old names for top-level modules, added to `UnboundGlobal` with their JSDoc.
 * @param lifecycle The client's lifecycle functions, typed on both shapes with their JSDoc.
 * @returns The `global.d.ts` file text (unformatted, no banner).
 */
export function buildGlobal(
	entries: ModuleEntry[],
	internalExports: Set<string>,
	ownerByName: Map<string, string>,
	aliases: NamespaceAlias[] = [],
	lifecycle: Lifecycle = readLifecycle(),
): string {
	const outPath = GLOBAL_OUT;
	const sourceFile = parseSource('global.d.ts', bundle(TYPES_INDEX, true));

	stripInternal(sourceFile, new Set<string>(), new Set<string>());

	// Keep only the ambient `declare global` blocks and the imports that may feed them; the named
	// type surface lives in `_internal.d.ts`.
	for (const statement of sourceFile.getStatements()) {
		if (Node.isModuleDeclaration(statement) && statement.hasDeclareKeyword()) {
			continue;
		}

		if (Node.isImportDeclaration(statement)) {
			continue;
		}

		if (declaredNames(statement).length > 0 || Node.isExportDeclaration(statement)) {
			statement.remove();
		}
	}

	const ambient = sourceFile.getStatements().filter(Node.isModuleDeclaration);
	const scopeGlobals = addonScopeGlobals();

	const scope = sourceFile.addTypeAlias({
		isExported: true,
		name: 'AddonScope',
		type: `{ ${scopeGlobals.map(([name, global]) => `/** ${global.doc} */ ${name}: ${global.sdkType};`).join(' ')} }`,
		docs: [
			'The globals a plugin runs with, keyed by name. Plugin code reads them without an import.',
		],
	});

	const referenced = collectReferencedNames([...ambient, scope]);
	const declaredInAmbient = new Set<string>();

	for (const statement of ambient) {
		const body = statement.getBody();

		if (!body || !Node.isStatemented(body)) {
			continue;
		}

		for (const inner of body.getStatements()) {
			for (const name of declaredNames(inner)) declaredInAmbient.add(name);
		}
	}

	// A re-export creates no local binding, so every name the ambient block references needs a real
	// import or local declaration. Anything left resolves ambiently (lib globals like `Promise`).
	const bound = new Set<string>();

	for (const statement of sourceFile.getStatements()) {
		if (!Node.isImportDeclaration(statement)) {
			continue;
		}

		const defaultImport = statement.getDefaultImport();

		if (defaultImport) {
			if (referenced.has(defaultImport.getText())) {
				bound.add(defaultImport.getText());
			} else {
				statement.removeDefaultImport();
			}
		}

		for (const specifier of statement.getNamedImports()) {
			const local = specifier.getAliasNode()?.getText() ?? specifier.getName();

			if (referenced.has(local)) {
				bound.add(local);
			} else {
				specifier.remove();
			}
		}

		if (
			!statement.getDefaultImport() &&
			!statement.getNamespaceImport() &&
			statement.getNamedImports().length === 0
		) {
			statement.remove();
		}
	}

	const unbound = [...referenced].filter(
		(name) => !declaredInAmbient.has(name) && !bound.has(name),
	);
	const imports = typeOnlyStatements('import', groupByOwner(unbound, ownerByName), outPath);

	if (imports.length > 0) {
		sourceFile.insertStatements(0, imports.join('\n'));
	}

	const reexport = sourceFile.addExportDeclaration({
		isTypeOnly: true,
		namedExports: [...internalExports].sort().map((name) => ({ name })),
		moduleSpecifier: relativeSpecifier(outPath, INTERNAL_OUT),
	});

	// Sort ahead of the ambient block kept from the bundle.
	reexport.setOrder(0);

	const pathOf = new Map(
		entries
			.filter((entry) => entry.topLevel)
			.map((entry) => [
				entry.name,
				'./' + relative(API_SRC, entry.out).split('\\').join('/'),
			]),
	);

	sourceFile.addInterface({
		isExported: true,
		name: 'UnboundLifecycle',
		docs: lifecycle.doc ? [lifecycle.doc] : [],
		methods: lifecycle.members.map((member) => ({
			name: member.name,
			parameters: member.parameters.map(({ name, type, optional }) => ({
				name,
				type,
				hasQuestionToken: optional,
			})),
			returnType: member.returnType,
			docs: member.doc ? [member.doc] : [],
		})),
	});

	sourceFile.addInterface({
		isExported: true,
		name: 'UnboundGlobal',
		extends: ['UnboundLifecycle'],
		docs: [
			'The global `unbound` object while the client is initialized: the API plus the lifecycle.',
		],
		properties: [
			...[...pathOf].map(([name, path]) => ({
				name,
				type: `typeof import('${path}')`,
				docs: [
					`The \`${name}\` module, which plugins also import from \`@unbound-app/api/${name}\`.`,
				],
			})),
			...aliases.map((alias) => ({
				name: alias.name,
				type: `typeof import('${pathOf.get(alias.target)}')`,
				docs: alias.doc ? [alias.doc] : [],
			})),
		],
	});

	const global = sourceFile.addModule({
		hasDeclareKeyword: true,
		declarationKind: ModuleDeclarationKind.Global,
		name: 'global',
	});

	global.addInterface({
		name: 'Window',
		properties: [{ name: 'unbound', type: 'UnboundGlobal | UnboundLifecycle' }],
	});

	global.addVariableStatements(
		scopeGlobals
			.filter(([, global]) => global.declare)
			.map(([name]) => ({
				declarationKind: VariableDeclarationKind.Const,
				declarations: [{ name, type: `AddonScope['${name}']` }],
			})),
	);

	return `${IMAGE_MODULES_REFERENCE}\n\n${sourceFile.getFullText().trim()}\n`;
}

/**
 * @description Builds the `@unbound-app/api` `exports` map: the root, the globals, each module, and the
 * shared types, and the hand-written testing kit in `packages/api/testing` (its preset and the fakes it is built from).
 * @param entries The emitted module entries.
 * @returns The map, sorted by subpath.
 */
export function buildExports(entries: ModuleEntry[]): Record<string, string> {
	const exports: Record<string, string> = {
		'.': './src/index.d.ts',
		'./global': './src/global.d.ts',
		'./testing': './testing/index.ts',
		'./testing/fakes': './testing/fakes.ts',
		'./testing/preset': './testing/preset.ts',
		'./types': './src/_types.d.ts',
	};

	for (const entry of entries) {
		if (Object.hasOwn(exports, `./${entry.name}`)) {
			throw new Error(
				`Module '${entry.name}' collides with a reserved @unbound-app/api subpath.`,
			);
		}

		exports[`./${entry.name}`] = './src/' + relative(API_SRC, entry.out).split('\\').join('/');
	}

	const ordered: Record<string, string> = {};

	for (const key of Object.keys(exports).sort()) ordered[key] = exports[key];

	return ordered;
}

/**
 * @description Rewrites `packages/api/package.json` with the derived version and the regenerated
 * `exports` map, preserving every other field.
 * @param version The `<client version>-<hash>` string to write.
 * @param entries The emitted module entries used to build the `exports` map.
 */
export function writeManifest(version: string, entries: ModuleEntry[]) {
	const manifest = readJson(API_MANIFEST);

	manifest.version = version;
	manifest.exports = buildExports(entries);
	manifest.files = ['src', 'ambient', 'testing'];
	// The testing kit is ESM TypeScript that the CLI's rollup config imports under Node.
	manifest.type = 'module';

	writeFileSync(API_MANIFEST, JSON.stringify(manifest, null, '\t') + '\n');
}
