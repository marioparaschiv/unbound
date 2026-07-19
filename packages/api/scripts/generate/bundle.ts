import { generateDtsBundle, type EntryPointConfig } from 'dts-bundle-generator';
import { join, dirname, isAbsolute } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import { Node } from 'ts-morph';

import {
	SDK_TSCONFIG,
	INLINED_LIBRARIES,
	TYPES_INDEX,
	UTILS_INDEX,
	UTILS_OUT,
	INTERNAL_OUT,
	API_SRC,
	relativeSpecifier,
	readJson,
	CLIENT,
	logger,
} from './paths';
import { stripInternal, declaredNames, exportedNames, collectReferencedNames } from './transform';
import { parseSource } from './project';

export type HoistFile = {
	/** The absolute output path of the generated hoist file. */
	out: string;
	/** The flattened, `@internal`-stripped declaration text of the library's own surface. */
	text: string;
	/** The names the hoist file declares, used to attribute inlined declarations back to their owner. */
	names: Set<string>;
	/** The names the hoist file exports - the surface other files may legally re-export. */
	exportedNames: Set<string>;
	/** The hoist files this file imports from, so reachability keeps its dependencies emitted. */
	deps: Set<string>;
};

export type LibraryBundle = {
	text: string;
	names: Set<string>;
	/** The names the hoist file exports - the surface other files may legally re-export. */
	exportedNames: Set<string>;
	/** The hoist files this file imports from, so reachability keeps its dependencies emitted. */
	deps: Set<string>;
};

export type HoistFiles = {
	files: HoistFile[];
	ownerByName: Map<string, string>;
};

/**
 * @description Runs `dts-bundle-generator` over a single source file, inlining the workspace
 * libraries and leaving react/react-native external.
 * @param source The absolute path to the entry's source file.
 * @param inlineDeclareGlobals Whether to inline `declare global` blocks (only the globals bundle needs them).
 * @returns The flattened `.d.ts` bundle as a string.
 */
export function bundle(source: string, inlineDeclareGlobals: boolean = false): string {
	const entry: EntryPointConfig = {
		filePath: source,
		libraries: { inlinedLibraries: INLINED_LIBRARIES },
		output: { noBanner: true, inlineDeclareGlobals, sortNodes: true },
	};

	const [result] = generateDtsBundle([entry], { preferredConfigPath: SDK_TSCONFIG });

	return result;
}

/**
 * @description Locates a library's package directory by probing `node_modules` upward from the
 * client package, matching Node's resolution walk without requiring the package to export its
 * manifest through an `exports` map. The directory is canonicalised (workspace packages are
 * symlinked), so dts-bundle-generator sees the real source path its symbol resolution needs.
 * @param library The package name to locate.
 * @returns The package directory, or `undefined` when the package is not installed.
 */
function findPackageDir(library: string): string | undefined {
	let dir = CLIENT;

	while (true) {
		const candidate = join(dir, 'node_modules', library);
		if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);

		const parent = dirname(dir);
		if (parent === dir) return void 0;

		dir = parent;
	}
}

/**
 * @description Resolves the file that carries a library's typings, in the order the ecosystem
 * declares them: the root export's `types` condition, the `types`/`typings` manifest fields, then
 * a declaration file derived from `main`. Every candidate is validated on disk.
 * @param library The package name to resolve.
 * @returns The absolute typings path, or `undefined` when the package declares none that exist.
 */
export function resolveLibraryTypes(library: string): string | undefined {
	const packageDir = findPackageDir(library);
	if (!packageDir) return void 0;

	const manifest = readJson(join(packageDir, 'package.json'));
	const rootExport = manifest.exports?.['.'];

	const candidates = [
		typeof rootExport === 'string' ? rootExport : rootExport?.types,
		manifest.types,
		manifest.typings,
		typeof manifest.main === 'string'
			? manifest.main.replace(/\.([cm]?)js$/, '.d.$1ts')
			: void 0,
	];

	for (const candidate of candidates) {
		if (typeof candidate !== 'string') continue;

		const resolved = join(packageDir, candidate);
		if (existsSync(resolved)) return resolved;
	}

	return void 0;
}

/**
 * @description Bundles a single library's own typings standalone and reads the declaration names it
 * introduces. This is what makes hoisting automatic: any of these names later found inlined into a
 * module was pulled in from this library, so it is removed from the module and imported from the
 * library's hoist file instead - the type never lands on a consuming module's own surface.
 * @param library The library specifier to bundle (an inlined library, or the `@unbound-app/types` index path).
 * @param out The absolute output path of this hoist file, used to resolve relative import specifiers.
 * @param ownerByName Names already owned by an earlier hoist file. Declarations for these names are
 * pruned so each shared type is declared in exactly one file (e.g. the utils names claimed by
 * `utils.d.ts` are removed from the `@unbound-app/types` index bundle that would otherwise re-declare
 * them in `_internal.d.ts`); any pruned name still referenced by a surviving declaration is imported
 * from its owning hoist file so the reference resolves.
 * @returns The bundle text and the set of names it declares, or `undefined` if it has no typings.
 */
export function bundleLibrary(
	library: string,
	out: string,
	ownerByName: Map<string, string> = new Map<string, string>(),
): LibraryBundle | undefined {
	let entry: string;
	if (isAbsolute(library)) {
		entry = library;
	} else {
		const resolved = resolveLibraryTypes(library);
		if (!resolved) {
			// A library without a resolvable typings entry (e.g. one exporting per-file) has no
			// standalone bundle to hoist; its declarations, if any, stay inlined as before.
			logger.debug(`Skipping hoist for '${library}': no resolvable typings entry.`);
			return void 0;
		}

		entry = resolved;
	}

	// dts-bundle-generator only ingests `.ts`/`.d.ts` entries; it mangles `.d.mts`/`.d.cts` paths.
	if (!entry.endsWith('.ts') || !existsSync(entry)) {
		logger.debug(
			`Skipping hoist for '${library}': '${entry}' is not a bundleable typings entry.`,
		);
		return void 0;
	}

	const sourceFile = parseSource('lib.d.ts', bundle(entry, true));

	stripInternal(sourceFile, new Set<string>(), new Set<string>());

	// The `declare global` block (ambient `$$DEV$$`, `UnboundNative`, `React`, …) belongs to
	// `global.d.ts`, not to a hoist file whose job is the library's named type surface. Declarations
	// already claimed by an earlier hoist file are pruned so no shared type is declared twice.
	for (const statement of sourceFile.getStatements()) {
		if (Node.isModuleDeclaration(statement) && statement.hasDeclareKeyword()) {
			statement.remove();
			continue;
		}

		const declared = declaredNames(statement);
		if (declared.length === 0) continue;

		if (declared.every((name) => ownerByName.has(name))) {
			statement.remove();
			continue;
		}

		// Only variable statements declare several names at once; owned ones are pruned individually
		// so a mixed-ownership statement never re-declares a name that already has a home.
		if (Node.isVariableStatement(statement)) {
			for (const declaration of statement.getDeclarations()) {
				if (ownerByName.has(declaration.getName())) declaration.remove();
			}
		}
	}

	const survivors = sourceFile.getStatements();

	// A pruned name still referenced by a surviving declaration must be imported from its owning hoist
	// file so the reference resolves (e.g. `_internal.d.ts` referencing `Fn`, now owned by `utils.d.ts`).
	const referenced = collectReferencedNames(survivors);
	const importsByOwner = new Map<string, Set<string>>();

	for (const name of referenced) {
		const owner = ownerByName.get(name);
		if (owner === void 0 || owner === out) continue;

		const bucket = importsByOwner.get(owner) ?? new Set<string>();
		bucket.add(name);
		importsByOwner.set(owner, bucket);
	}

	const imports = [...importsByOwner.entries()]
		.map(([owner, importedNames]) => {
			const specifier = relativeSpecifier(out, owner);
			return `import type { ${[...importedNames].sort().join(', ')} } from '${specifier}';`;
		})
		.sort();

	if (imports.length > 0) sourceFile.insertStatements(0, imports.join('\n'));

	const names = new Set<string>();
	for (const statement of survivors) {
		for (const name of declaredNames(statement)) names.add(name);
	}

	if (names.size === 0) return void 0;

	return {
		text: sourceFile.getFullText(),
		names,
		exportedNames: exportedNames(sourceFile),
		deps: new Set(importsByOwner.keys()),
	};
}

/**
 * @description Builds one hoist file per inlined library (plus `@unbound-app/types`, keyed to the
 * fixed `utilities.d.ts` home). Libraries whose typings never surface a declaration are skipped, so
 * only libraries that would otherwise leak types get a file.
 * @returns The hoist files keyed by output path, and a map attributing each declared name to its owner.
 */
export function buildHoistFiles(): HoistFiles {
	const files: HoistFile[] = [];
	const ownerByName = new Map<string, string>();

	// The utils typings are hoisted first so their names (`Fn`, `Widen`, …) claim the public `utils.d.ts`
	// home before the full `@unbound-app/types` index bundle claims the remaining names for `_internal.d.ts`
	// (both feed `global.d.ts`), so each shared type has exactly one home and neither duplicates a `types.d.ts`.
	const assigned = new Set<string>([UTILS_OUT, INTERNAL_OUT]);

	const outFor = (library: string): string => {
		const flat = (name: string) => join(API_SRC, `${name.split('/').join('-')}.d.ts`);

		const out = flat(library.replace(/^@[^/]+\//, ''));
		if (!assigned.has(out)) return out;

		// A scope-stripped name that is already taken (e.g. `@unbound-app/utils` vs the fixed
		// `utils.d.ts` home) keeps its scope so distinct libraries never share a file.
		const scoped = flat(library.replace(/^@/, ''));
		if (!assigned.has(scoped)) return scoped;

		throw new Error(
			`Hoist file name collision for '${library}': '${scoped}' is already taken.`,
		);
	};

	const sources: { library: string; out: string }[] = [
		{ library: UTILS_INDEX, out: UTILS_OUT },
		{ library: TYPES_INDEX, out: INTERNAL_OUT },
		...INLINED_LIBRARIES.filter((library) => library !== '@unbound-app/types').map(
			(library) => {
				const out = outFor(library);
				assigned.add(out);

				return { library, out };
			},
		),
	];

	for (const { library, out } of sources) {
		const bundled = bundleLibrary(library, out, ownerByName);
		if (!bundled) continue;

		files.push({
			out,
			text: bundled.text,
			names: bundled.names,
			exportedNames: bundled.exportedNames,
			deps: bundled.deps,
		});

		for (const name of bundled.names) {
			if (!ownerByName.has(name)) ownerByName.set(name, out);
		}
	}

	return { files, ownerByName };
}
