import { generateDtsBundle, type EntryPointConfig } from 'dts-bundle-generator';
import { existsSync } from 'node:fs';
import { Node } from 'ts-morph';
import { join } from 'node:path';

import {
	SDK_TSCONFIG,
	INLINED_LIBRARIES,
	TYPES_INDEX,
	UTILS_INDEX,
	UTILS_OUT,
	INTERNAL_OUT,
	API_SRC,
	relativeSpecifier,
	clientRequire,
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
	if (library.endsWith('.d.ts')) {
		entry = library;
	} else {
		try {
			entry = clientRequire.resolve(library).replace(/\.js$/, '.d.ts');
		} catch {
			// A library without a resolvable single entry point (e.g. one exporting per-file) has no
			// standalone bundle to hoist; its declarations, if any, stay inlined as before.
			logger.debug(`Skipping hoist for '${library}': no resolvable entry point.`);
			return void 0;
		}
	}

	if (!existsSync(entry)) return void 0;

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
		if (declared.length > 0 && declared.every((name) => ownerByName.has(name)))
			statement.remove();
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
	const sources: { library: string; out: string }[] = [
		{ library: UTILS_INDEX, out: UTILS_OUT },
		{ library: TYPES_INDEX, out: INTERNAL_OUT },
		...INLINED_LIBRARIES.filter((library) => library !== '@unbound-app/types').map(
			(library) => ({
				library,
				out: join(
					API_SRC,
					`${library
						.replace(/^@[^/]+\//, '')
						.split('/')
						.join('-')}.d.ts`,
				),
			}),
		),
	];

	for (const { library, out } of sources) {
		if (files.some((file) => file.out === out)) continue;

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
