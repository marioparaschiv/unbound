/**
 * Copies the declarations the REPL's type checker reads into `crates/repl/types/packages`, which it unpacks as
 * `node_modules`. Rerun after bumping `@unbound-app/api`, React or React Native.
 */

import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = join(import.meta.dir, '..', '..', '..');
const out = join(import.meta.dir, '..', 'crates', 'repl', 'types', 'packages');
const api = join(root, 'packages', 'api');

/** Each package's folder in `node_modules`, resolved from the package that depends on it. */
const packages = [
	['@unbound-app/api', api],
	['@types/react', realpathSync(join(api, 'node_modules', '@types', 'react'))],
	['react-native', realpathSync(join(api, 'node_modules', 'react-native'))],
] as const;

function resolveFrom(folder: string, name: string): string | undefined {
	for (let dir = folder; dir !== dirname(dir); dir = dirname(dir)) {
		const candidate = join(dir, 'node_modules', name);

		if (existsSync(candidate)) {
			return realpathSync(candidate);
		}
	}

	return undefined;
}

/** Folders no import reaches: nested packages, tests, and React Native's opt-in strict API. */
const SKIPPED = new Set(['node_modules', 'tests', 'testing', '__tests__', 'types_generated']);

/** Every `.d.ts` under `folder`, skipping {@link SKIPPED}. */
function declarations(folder: string): string[] {
	const files: string[] = [];

	for (const entry of readdirSync(folder)) {
		if (SKIPPED.has(entry)) {
			continue;
		}

		const path = join(folder, entry);

		if (statSync(path).isDirectory()) {
			files.push(...declarations(path));
		} else if (entry.endsWith('.d.ts')) {
			files.push(path);
		}
	}

	return files;
}

function copyPackage(name: string, folder: string) {
	const target = join(out, name);

	for (const file of declarations(folder)) {
		const destination = join(target, relative(folder, file));

		mkdirSync(dirname(destination), { recursive: true });
		cpSync(file, destination);
	}

	const manifest = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
	const trimmed = {
		name: manifest.name,
		version: manifest.version,
		types: manifest.types,
		exports: manifest.exports,
	};

	mkdirSync(target, { recursive: true });
	Bun.write(join(target, 'package.json'), `${JSON.stringify(trimmed, null, '\t')}\n`);
}

rmSync(out, { recursive: true, force: true });

const queue: [string, string][] = [...packages];
const seen = new Set<string>();

while (queue.length > 0) {
	const [name, folder] = queue.shift()!;

	if (seen.has(name)) {
		continue;
	}

	seen.add(name);
	copyPackage(name, folder);

	// Type-only dependencies the declarations import: React's CSS types and React Native's list types.
	for (const dependency of ['csstype', '@react-native/virtualized-lists']) {
		const resolved = resolveFrom(folder, dependency);

		if (resolved && !seen.has(dependency)) {
			queue.push([dependency, resolved]);
		}
	}
}

console.log(`Copied ${seen.size} packages into ${relative(root, out)}`);
