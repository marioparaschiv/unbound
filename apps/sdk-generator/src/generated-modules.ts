import { collectReferencedNames, declaredNames } from './transform';
import { GENERATED_MODULES } from './paths';
import { parseSource } from './project';

/**
 * @description Adds a type import of each module a plugin's build generates, for the names a bundled module
 * references but does not declare. The bundler drops those imports because the client resolves the module
 * to its own ambient copy, which it cannot bundle.
 * @param text The bundled module.
 * @param modules Each generated specifier, mapping the referenced name to the name the module exports.
 * @returns The module, with an `import type` per generated module it uses.
 */
export function importGeneratedModules(
	text: string,
	modules: Record<string, Record<string, string>> = GENERATED_MODULES,
): string {
	const sourceFile = parseSource('generated-modules.d.ts', text);
	const statements = sourceFile.getStatements();
	const referenced = collectReferencedNames(statements);
	const declared = new Set(statements.flatMap(declaredNames));
	let changed = false;

	for (const [specifier, names] of Object.entries(modules)) {
		const used = Object.keys(names).filter(
			(name) => referenced.has(name) && !declared.has(name),
		);

		if (used.length === 0) {
			continue;
		}

		changed = true;
		sourceFile.insertImportDeclaration(0, {
			isTypeOnly: true,
			moduleSpecifier: specifier,
			namedImports: used.map((name) =>
				names[name] === name ? { name } : { name: names[name], alias: name },
			),
		});
	}

	return changed ? sourceFile.getFullText() : text;
}

export default { importGeneratedModules };
