import { dirname, join, relative, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

/** The web app's `src`, which `~/` resolves to. */
export const SRC = resolve(import.meta.dir, '../../src');

const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
const transpilers = {
	ts: new Bun.Transpiler({ loader: 'ts' }),
	tsx: new Bun.Transpiler({ loader: 'tsx' }),
};

/** One import the walk met: the importing file, its specifier and the source file it resolved to. */
export type ImportEdge = {
	from: string;
	specifier: string;
	target: string | undefined;
};

/**
 * @description Lists the TypeScript files under a directory, recursively.
 * @param directory The absolute directory.
 * @returns Their absolute paths.
 */
export function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { recursive: true, encoding: 'utf8' })
		.filter((name) => /\.tsx?$/.test(name))
		.map((name) => join(directory, name));
}

/**
 * @description Resolves a `~/` or relative specifier to a source file under `src`.
 * @param from The importing file.
 * @param specifier The import specifier.
 * @returns The file, or `undefined` for a package import.
 */
export function resolveImport(from: string, specifier: string): string | undefined {
	let target: string | undefined;

	if (specifier.startsWith('~/')) {
		target = join(SRC, specifier.slice(2));
	} else if (specifier.startsWith('.')) {
		target = resolve(dirname(from), specifier);
	}

	if (!target) return;

	if (/\.tsx?$/.test(target) && existsSync(target)) {
		return target;
	}

	return EXTENSIONS.map((extension) => target + extension).find((path) => existsSync(path));
}

/**
 * @description Names a source file by its `~/` alias, without extension or `/index`.
 * @param file The absolute file.
 * @returns The alias, such as `~/lib/bot`.
 */
export function asAlias(file: string): string {
	return `~/${relative(SRC, file).replace(/(\/index)?\.tsx?$/, '')}`;
}

/**
 * @description Walks the static import graph from the entries through every source file it reaches.
 * @param entries The absolute files to start from.
 * @param visit Called once per import met, including package imports.
 * @returns Every reached file, relative to `src`.
 */
export async function walkImports(
	entries: string[],
	visit?: (edge: ImportEdge) => void,
): Promise<Set<string>> {
	const seen = new Set<string>();
	const queue = [...entries];

	for (let file = queue.pop(); file; file = queue.pop()) {
		if (seen.has(file)) {
			continue;
		}

		seen.add(file);

		const transpiler = file.endsWith('.tsx') ? transpilers.tsx : transpilers.ts;

		for (const { path: specifier } of transpiler.scanImports(await Bun.file(file).text())) {
			const target = resolveImport(file, specifier);

			visit?.({ from: file, specifier, target });

			if (target) {
				queue.push(target);
			}
		}
	}

	return new Set([...seen].map((path) => relative(SRC, path)));
}

export default { walkImports };
