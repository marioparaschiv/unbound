import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join(import.meta.dir, '..');

export const DEPENDENCY_FIELDS = [
	'dependencies',
	'devDependencies',
	'peerDependencies',
	'optionalDependencies',
];

export type Manifest = Record<string, any>;

export interface Workspaces {
	manifests: Map<string, Manifest>;
	dirs: Map<string, string>;
}

export function readManifest(path: string): Manifest {
	return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadWorkspaces(): Workspaces {
	const packages: string[] = readManifest(join(ROOT, 'package.json')).workspaces.packages;

	const manifests = new Map<string, Manifest>();
	const dirs = new Map<string, string>();

	for (const dir of packages) {
		const manifest = readManifest(join(ROOT, dir, 'package.json'));

		manifests.set(dir, manifest);
		dirs.set(manifest.name, dir);
	}

	return { manifests, dirs };
}

export function workspaceDependencies(manifest: Manifest, dirs: Map<string, string>): string[] {
	const dependencies: string[] = [];

	for (const field of DEPENDENCY_FIELDS) {
		for (const [name, specifier] of Object.entries<string>(manifest[field] ?? {})) {
			if (!specifier.startsWith('workspace:')) continue;

			const dir = dirs.get(name);
			if (!dir) throw new Error(`No workspace package resolves ${name}@${specifier}.`);

			dependencies.push(dir);
		}
	}

	return dependencies;
}
