import { Node, SyntaxKind, type SourceFile } from 'ts-morph';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { API_SRC, CLIENT, ROOT } from './paths';
import { parseSource } from './project';

/** A pure source file the SDK ships a copy of, and how its imports are rewritten to resolve inside `packages/api/src`. */
type CopiedConvention = {
	source: string;
	out: string;
	/** Each import specifier the source may use, mapped to the one its copy uses. Any other import fails the run. */
	imports?: Record<string, string>;
};

/** The folder of `packages/api/src` that holds the conventions the testing kit imports instead of copying. */
export const CONVENTIONS_OUT = join(API_SRC, '_conventions');

// Pure modules the testing kit needs at runtime, copied from their one source in the private packages.
const COPIED: CopiedConvention[] = [
	{ source: 'packages/contracts/src/addon-locales.ts', out: 'addon-locales.ts' },
	{ source: 'packages/contracts/src/addon-assets.ts', out: 'addon-assets.ts' },
	{
		source: 'packages/utils/src/walk-tree.ts',
		out: 'walk-tree.ts',
		imports: { '@unbound-app/types/utils': '../_types' },
	},
];

// The client modules whose `findByPropsLazy` lookups name the props each `metro.<namespace>` member is found by.
const METRO_TABLES = [
	{
		name: 'COMMON_PROPS',
		namespace: 'common',
		source: join(CLIENT, 'src', 'metro', 'common.ts'),
	},
	{ name: 'API_PROPS', namespace: 'api', source: join(CLIENT, 'src', 'metro', 'api.ts') },
];

const LAZY_REGISTRY = join(CLIENT, 'src', 'metro', 'lazy-registry.ts');

/**
 * @description Rewrites a pure source file's imports so its copy resolves inside the SDK.
 * @param path The source's path, named in the error.
 * @param text The source text.
 * @param imports Each allowed import specifier, mapped to the one the copy uses.
 * @returns The copy's text.
 */
export function copyConvention(
	path: string,
	text: string,
	imports: Record<string, string> = {},
): string {
	const sourceFile = parseSource('convention.ts', text);

	for (const declaration of sourceFile.getImportDeclarations()) {
		const specifier = declaration.getModuleSpecifierValue();
		const rewritten = imports[specifier];

		if (rewritten === undefined) {
			throw new Error(
				`Failed to copy convention ${path}: it imports '${specifier}', which the published SDK cannot resolve.`,
			);
		}

		declaration.setModuleSpecifier(rewritten);
	}

	return sourceFile.getFullText();
}

function lookupProps(sourceFile: SourceFile, path: string): [string, string[]][] {
	const table: [string, string[]][] = [];

	for (const statement of sourceFile.getVariableStatements()) {
		if (!statement.isExported()) continue;

		for (const declaration of statement.getDeclarations()) {
			const call = declaration.getInitializerIfKind(SyntaxKind.CallExpression);

			if (call?.getExpression().getText() !== 'findByPropsLazy') continue;

			const props = call.getArguments().map((argument) => {
				if (!Node.isStringLiteral(argument)) {
					throw new Error(
						`Failed to read the props of ${declaration.getName()} in ${path}: each must be a string literal.`,
					);
				}

				return argument.getLiteralValue();
			});

			table.push([declaration.getName(), props]);
		}
	}

	return table;
}

/**
 * @description Builds the metro conventions module: the client's lazy marker and the props each `metro.common` and
 * `metro.api` member is found by, read from the client's own lookups.
 * @param read Reads a source file; the filesystem by default.
 * @returns The module's text.
 */
export function buildMetroConventions(
	read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): string {
	const registry = parseSource('lazy-registry.ts', read(LAZY_REGISTRY));
	const marker = registry
		.getVariableDeclaration('LAZY_MARKER')
		?.getInitializerIfKind(SyntaxKind.StringLiteral)
		?.getLiteralValue();

	if (marker === undefined) {
		throw new Error(
			`Failed to read LAZY_MARKER from ${LAZY_REGISTRY}: it is not a string literal.`,
		);
	}

	const tables = METRO_TABLES.map(({ name, namespace, source }) => {
		const props = lookupProps(parseSource('metro-table.ts', read(source)), source);
		const rows = props.map(([member, names]) => `\t${member}: ${JSON.stringify(names)},`);

		return `/** The props each \`metro.${namespace}\` member is found by, as the client's lookups find them. */\nexport const ${name} = {\n${rows.join('\n')}\n} satisfies Record<string, string[]>;`;
	});

	return [
		'/** The key whose own descriptor marks a lazy metro handle, read without resolving it. */',
		`export const LAZY_MARKER = ${JSON.stringify(marker)};`,
		'',
		tables.join('\n\n'),
		'',
	].join('\n');
}

/**
 * @description Builds every convention file the SDK ships for its testing kit, keyed by output path.
 * @returns Each file's text (unformatted, no banner).
 */
export function buildConventions(): Map<string, string> {
	const files = new Map<string, string>();

	for (const { source, out, imports } of COPIED) {
		const path = join(ROOT, source);

		files.set(
			join(CONVENTIONS_OUT, out),
			copyConvention(path, readFileSync(path, 'utf8'), imports),
		);
	}

	files.set(join(CONVENTIONS_OUT, 'metro.ts'), buildMetroConventions());

	return files;
}
