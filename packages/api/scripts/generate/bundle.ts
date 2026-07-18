import { generateDtsBundle, type EntryPointConfig } from 'dts-bundle-generator';
import { Project, Node } from 'ts-morph';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
	SDK_TSCONFIG,
	INLINED_LIBRARIES,
	TYPES_INDEX,
	UTILITIES_OUT,
	API_SRC,
	clientRequire,
	logger,
} from './paths';
import { stripInternal, declaredNames } from './transform';

export type HoistFile = {
	/** The absolute output path of the generated hoist file. */
	out: string;
	/** The flattened, `@internal`-stripped declaration text of the library's own surface. */
	text: string;
	/** The names the hoist file declares, used to attribute inlined declarations back to their owner. */
	names: Set<string>;
};

export type LibraryBundle = {
	text: string;
	names: Set<string>;
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
 * @returns The bundle text and the set of names it declares, or `undefined` if it has no typings.
 */
export function bundleLibrary(library: string): LibraryBundle | undefined {
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

	const project = new Project({ useInMemoryFileSystem: true });
	const sourceFile = project.createSourceFile('lib.d.ts', bundle(entry, true));

	stripInternal(sourceFile, new Set<string>(), new Set<string>());

	// The `declare global` block (ambient `$$DEV$$`, `UnboundNative`, `React`, …) belongs to
	// `global.d.ts`, not to a hoist file whose job is the library's named type surface.
	for (const statement of sourceFile.getStatements()) {
		if (Node.isModuleDeclaration(statement) && statement.hasDeclareKeyword())
			statement.remove();
	}

	const names = new Set<string>();
	for (const statement of sourceFile.getStatements()) {
		for (const name of declaredNames(statement)) names.add(name);
	}

	if (names.size === 0) return void 0;

	return { text: sourceFile.getFullText(), names };
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

	// `@unbound-app/types` is hoisted under the fixed `utilities.d.ts` home (it also feeds `global.d.ts`),
	// so it is excluded from the per-library pass to avoid emitting a duplicate `types.d.ts`.
	const sources: { library: string; out: string }[] = [
		{ library: TYPES_INDEX, out: UTILITIES_OUT },
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

		const bundled = bundleLibrary(library);
		if (!bundled) continue;

		files.push({ out, text: bundled.text, names: bundled.names });

		for (const name of bundled.names) {
			if (!ownerByName.has(name)) ownerByName.set(name, out);
		}
	}

	return { files, ownerByName };
}
