import { extname } from 'node:path';

import { parseSync, Visitor, type ESTree } from './rolldown-utils.ts';

/** A value import in plugin source: one that would put the module into the bundle. */
export type ValueImport = { source: string; start: number };

const LANGS: Record<string, 'js' | 'jsx' | 'ts' | 'tsx'> = {
	'.js': 'jsx',
	'.jsx': 'jsx',
	'.mjs': 'js',
	'.ts': 'ts',
	'.mts': 'ts',
	'.tsx': 'tsx',
};

/** A specifier of an import or re-export, which may be marked type-only. */
type Specifier = ESTree.ImportDeclarationSpecifier | ESTree.ExportSpecifier;

function isTypeSpecifier(spec: Specifier): boolean {
	return (
		('importKind' in spec && spec.importKind === 'type') ||
		('exportKind' in spec && spec.exportKind === 'type')
	);
}

function allTypes(specifiers: Specifier[]): boolean {
	return specifiers.length > 0 && specifiers.every(isTypeSpecifier);
}

function literal(node: ESTree.Node | null | undefined): string | undefined {
	return node?.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;
}

/**
 * @description Tells whether the guard reads a file: plugin source in a language oxc parses.
 * @param id The module id.
 * @returns Whether it is JavaScript or TypeScript.
 */
export function isGuardedSource(id: string): boolean {
	return Object.hasOwn(LANGS, extname(id));
}

/**
 * @description Lists every import of a module that is not type-only: static imports and re-exports, `import()` and `require()`.
 * `import type`, `import { type X }` with only type specifiers, and `export type` are left out, since the TypeScript transform erases them.
 * @param code The module's source, before the TypeScript transform.
 * @param id The module id; its extension picks the parser's language.
 * @returns The imports, each with its specifier and offset.
 */
export function valueImports(code: string, id: string): ValueImport[] {
	const { program } = parseSync(id, code, { lang: LANGS[extname(id)] ?? 'tsx' });
	const found: ValueImport[] = [];

	function add(source: string | undefined, start: number) {
		if (source !== undefined) {
			found.push({ source, start });
		}
	}

	new Visitor({
		ImportDeclaration(node) {
			if (node.importKind === 'type' || allTypes(node.specifiers)) return;

			add(node.source.value, node.start);
		},
		ExportNamedDeclaration(node) {
			if (!node.source || node.exportKind === 'type' || allTypes(node.specifiers)) return;

			add(node.source.value, node.start);
		},
		ExportAllDeclaration(node) {
			if (node.exportKind === 'type') return;

			add(node.source.value, node.start);
		},
		ImportExpression(node) {
			add(literal(node.source), node.start);
		},
		CallExpression(node) {
			if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
				add(literal(node.arguments[0]), node.start);
			}
		},
	}).visit(program);

	return found;
}

export default { isGuardedSource, valueImports };
