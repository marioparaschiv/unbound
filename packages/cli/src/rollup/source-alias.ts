import { existsSync, statSync } from 'node:fs';
import type { Plugin } from 'rollup';
import { resolve } from 'node:path';

const extensions = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'];
const indexFiles = ['index.tsx', 'index.ts', 'index.jsx', 'index.js'];

function isFile(path: string) {
	return existsSync(path) && statSync(path).isFile();
}

/**
 * @description Resolves a module path the way a bundler would, trying source extensions and then index files.
 * @param candidate An absolute path, with or without its extension.
 * @returns The file it resolves to, or `null` when none exists.
 */
export function findFile(candidate: string): string | null {
	if (isFile(candidate)) {
		return candidate;
	}

	for (const extension of extensions) {
		if (isFile(`${candidate}${extension}`)) {
			return `${candidate}${extension}`;
		}
	}

	for (const indexFile of indexFiles) {
		if (isFile(resolve(candidate, indexFile))) {
			return resolve(candidate, indexFile);
		}
	}

	return null;
}

/**
 * @description Resolves `~/` imports to a plugin's `src` directory, mirroring the `paths` in its tsconfig.
 * @param sourceRoot Absolute path of the plugin's `src` directory.
 * @returns The rollup plugin.
 */
export function sourceAlias(sourceRoot: string): Plugin {
	return {
		name: 'plugin-source-alias',
		resolveId(source) {
			if (!source.startsWith('~/')) return null;

			return findFile(resolve(sourceRoot, source.slice(2)));
		},
	};
}

export default { findFile, sourceAlias };
