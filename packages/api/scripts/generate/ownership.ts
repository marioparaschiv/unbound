import { readFileSync } from 'node:fs';
import { Project } from 'ts-morph';

import type { ModuleEntry } from './paths';

/** Matches `@unbound-app/types/<subpath>` and captures `<subpath>` (the barrel `@unbound-app/types` has no subpath and is skipped). */
const TYPES_SUBPATH = /^@unbound-app\/types\/([^/]+)$/;

/**
 * @description Reads the type names each module owns, so the hoist pass re-exports them from the
 * module instead of importing them bare. A module owns a type when its source imports the name from a
 * specific `@unbound-app/types/<subpath>` (e.g. `/assets`, `/toasts`) other than `utils` - the barrel
 * and `/utils` imports are shared/incidental and stay non-exported. `dts-bundle-generator` erases the
 * import path, so ownership is read from the original source, not the bundle.
 * @param entries The module entries whose sources are parsed; the root (`.`) barrel is skipped.
 * @returns A map from each module's output `.d.ts` path to the set of type names it owns (owning
 * modules only; modules that own nothing are absent).
 */
export function buildOwnership(entries: ModuleEntry[]): Map<string, Set<string>> {
	const owned = new Map<string, Set<string>>();

	for (const entry of entries) {
		if (entry.name === '.') continue;

		const project = new Project({ useInMemoryFileSystem: true });
		const sourceFile = project.createSourceFile(
			'module.ts',
			readFileSync(entry.source, 'utf8'),
		);

		const names = new Set<string>();

		for (const declaration of sourceFile.getImportDeclarations()) {
			const specifier = declaration.getModuleSpecifierValue();
			const match = TYPES_SUBPATH.exec(specifier);
			if (!match) continue;
			if (match[1] === 'utils') continue;

			// A namespace import cannot map to per-name ownership; default and named imports can.
			const defaultImport = declaration.getDefaultImport();
			if (defaultImport) names.add(defaultImport.getText());

			for (const named of declaration.getNamedImports()) {
				names.add(named.getName());
			}
		}

		if (names.size > 0) owned.set(entry.out, names);
	}

	return owned;
}
