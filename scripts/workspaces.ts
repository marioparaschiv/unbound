import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

export const ROOT = join(import.meta.dir, '..');

export const DEPENDENCY_FIELDS = [
	'dependencies',
	'devDependencies',
	'peerDependencies',
	'optionalDependencies',
] as const;

export type DependencyField = (typeof DEPENDENCY_FIELDS)[number];

export type DependencyMap = Record<string, string>;

export type ExportTarget = {
	types: string;
	import: string;
};

type WorkspaceConfig = {
	packages: string[];
	catalog?: DependencyMap;
	catalogs?: Record<string, DependencyMap>;
};

export type Manifest = Partial<Record<DependencyField, DependencyMap>> & {
	name: string;
	version: string;
	private?: boolean;
	types?: string;
	module?: string;
	bin?: Record<string, string>;
	exports?: Record<string, string | ExportTarget>;
	scripts?: Record<string, string>;
	workspaces?: WorkspaceConfig;
};

export type Workspaces = {
	manifests: Map<string, Manifest>;
	dirs: Map<string, string>;
};

/**
 * @description Parses the text of a `package.json`, checking the `name` every workspace manifest carries.
 * @param text The manifest's JSON.
 * @param path Where the text came from, named in the error.
 * @returns The parsed manifest.
 */
export function parseManifest(text: string, path: string): Manifest {
	const value: unknown = JSON.parse(text);

	if (!isManifest(value)) {
		throw new Error(`${path} is not a package manifest: it has no string \`name\`.`);
	}

	return value;
}

// UNKNOWN: a parsed `package.json`, narrowed on the field every manifest has.
function isManifest(value: unknown): value is Manifest {
	return (
		typeof value === 'object' &&
		value !== null &&
		'name' in value &&
		typeof value.name === 'string'
	);
}

/**
 * @description Reads and parses a `package.json`.
 * @param path The absolute path of the manifest.
 * @returns The parsed manifest.
 */
export function readManifest(path: string): Manifest {
	return parseManifest(readFileSync(path, 'utf8'), path);
}

// Entries may be globs (`packages/plugins/*`); only the matched directories with a manifest are workspaces.
function expandWorkspaces(patterns: string[]): string[] {
	return patterns.flatMap((pattern) => {
		if (!pattern.includes('*')) {
			return [pattern];
		}

		const matches = new Bun.Glob(`${pattern}/package.json`).scanSync({ cwd: ROOT });

		return [...matches].map((path) => dirname(path)).sort((a, b) => a.localeCompare(b));
	});
}

/**
 * @description Loads every workspace the root manifest declares, expanding glob entries.
 * @returns The manifests keyed by directory, and the directories keyed by package name.
 */
export function loadWorkspaces(): Workspaces {
	const packages = readManifest(join(ROOT, 'package.json')).workspaces?.packages ?? [];

	const manifests = new Map<string, Manifest>();
	const dirs = new Map<string, string>();

	for (const dir of expandWorkspaces(packages)) {
		const manifest = readManifest(join(ROOT, dir, 'package.json'));

		manifests.set(dir, manifest);
		dirs.set(manifest.name, dir);
	}

	return { manifests, dirs };
}

/**
 * @description Lists the workspace directories a manifest depends on through `workspace:` specifiers.
 * @param manifest The dependent package's manifest.
 * @param dirs The workspace directories keyed by package name.
 * @returns The directories of the workspace dependencies.
 */
export function workspaceDependencies(manifest: Manifest, dirs: Map<string, string>): string[] {
	const dependencies: string[] = [];

	for (const field of DEPENDENCY_FIELDS) {
		for (const [name, specifier] of Object.entries(manifest[field] ?? {})) {
			if (!specifier.startsWith('workspace:')) {
				continue;
			}

			const dir = dirs.get(name);

			if (!dir) {
				throw new Error(`No workspace package resolves ${name}@${specifier}.`);
			}

			dependencies.push(dir);
		}
	}

	return dependencies;
}
