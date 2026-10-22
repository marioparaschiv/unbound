import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const tsconfig = JSON.parse(readFileSync(resolve(repositoryRoot, 'tsconfig.json'), 'utf8'));
const aliases = Object.entries(tsconfig.compilerOptions.paths);
const extensions = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'];
const indexFiles = ['index.tsx', 'index.ts', 'index.jsx', 'index.js', 'index.mjs'];

function findModule(source) {
	for (const [pattern, targets] of aliases) {
		const wildcardIndex = pattern.indexOf('*');
		const prefix = wildcardIndex < 0 ? pattern : pattern.slice(0, wildcardIndex);
		const suffix = wildcardIndex < 0 ? '' : pattern.slice(wildcardIndex + 1);

		if (wildcardIndex < 0 && source !== pattern) continue;
		if (wildcardIndex >= 0 && (!source.startsWith(prefix) || !source.endsWith(suffix)))
			continue;

		const value =
			wildcardIndex < 0
				? ''
				: source.slice(
						prefix.length,
						suffix.length ? source.length - suffix.length : undefined,
					);

		for (const target of targets) {
			const candidate = resolve(repositoryRoot, target.replace('*', value));

			for (const extension of extensions) {
				const file = `${candidate}${extension}`;
				if (existsSync(file)) return file;
			}

			for (const indexFile of indexFiles) {
				const file = resolve(candidate, indexFile);
				if (existsSync(file)) return file;
			}
		}
	}

	return null;
}

export function bunPathAliases() {
	return {
		name: 'bun-tsconfig-path-aliases',
		resolveId(source) {
			return findModule(source);
		},
	};
}

export { hermesExpressionEntrypoint } from './entrypoint.mjs';
