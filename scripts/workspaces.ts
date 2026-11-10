import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

/** How the repo's checks treat a workspace, from its manifest's `checks` field. */
export type Checks = {
	/**
	 * How a pre-push runs its tests: one `bun test` (unset), `parallel` when its tests' `mock.module`
	 * calls leak across files in one process, or `none` when they need Postgres or a parent runs them.
	 */
	tests?: 'parallel' | 'none';
	/** `false` for a base `tsconfig.json` that only other projects extend. */
	typecheck?: false;
	/** Changing its own files runs every plugin's tests and type-check; workspaces inside it are plugins. */
	plugins?: true;
};

/** A directory the repo's checks test and type-check: a workspace, or tooling outside them. */
export type Project = {
	dir: string;
	checks: Checks;
	/** Whether it has a `tsconfig.json` to type-check. */
	typed: boolean;
	/** Whether it is a plugin, which `plugins:typecheck` type-checks rather than `bun run typecheck`. */
	plugin: boolean;
};

export type Manifest = Partial<Record<DependencyField, DependencyMap>> & {
	name: string;
	checks?: Checks;
	version: string;
	private?: boolean;
	types?: string;
	module?: string;
	bin?: Record<string, string>;
	exports?: Record<string, string | ExportTarget>;
	scripts?: Record<string, string>;
	workspaces?: WorkspaceConfig;
};

export type Workspace = { dir: string; manifest: Manifest };

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
 * @description Finds the workspace a `workspace:` specifier points at.
 * @param name The dependency's package name.
 * @param specifier Its `workspace:` specifier, named in the error.
 * @param workspaces The loaded workspaces.
 * @returns The workspace's directory and manifest.
 */
export function resolveWorkspace(
	name: string,
	specifier: string,
	{ manifests, dirs }: Workspaces,
): Workspace {
	const dir = dirs.get(name);
	const manifest = dir === undefined ? undefined : manifests.get(dir);

	if (dir === undefined || !manifest) {
		throw new Error(`No workspace package resolves ${name}@${specifier}.`);
	}

	return { dir, manifest };
}

/**
 * @description Lists the workspace directories a manifest depends on through `workspace:` specifiers.
 * @param manifest The dependent package's manifest.
 * @param workspaces The loaded workspaces.
 * @returns The directories of the workspace dependencies.
 */
export function workspaceDependencies(manifest: Manifest, workspaces: Workspaces): string[] {
	const dependencies: string[] = [];

	for (const field of DEPENDENCY_FIELDS) {
		for (const [name, specifier] of Object.entries(manifest[field] ?? {})) {
			if (specifier.startsWith('workspace:')) {
				dependencies.push(resolveWorkspace(name, specifier, workspaces).dir);
			}
		}
	}

	return dependencies;
}

/**
 * @description Orders the public workspaces so each publishes after its workspace dependencies, and the
 * registry never advertises a package whose pinned workspace dependencies do not exist yet.
 * @returns The public workspace directories, dependencies first.
 */
export function publishOrder(): string[] {
	const workspaces = loadWorkspaces();
	const publics = new Map([...workspaces.manifests].filter(([, manifest]) => !manifest.private));
	const sorted: string[] = [];
	const visited = new Set<string>();

	function visit(dir: string) {
		const manifest = publics.get(dir);

		if (!manifest || visited.has(dir)) return;

		visited.add(dir);

		for (const dependency of workspaceDependencies(manifest, workspaces)) visit(dependency);

		sorted.push(dir);
	}

	for (const dir of publics.keys()) visit(dir);

	return sorted;
}

// Tooling outside the workspaces that still type-checks: the repo's scripts, and a client script with no
// manifest. Their tests run nowhere before a push.
const DIRECTORIES: Pick<Project, 'dir' | 'checks'>[] = [
	{ dir: 'scripts', checks: { tests: 'none' } },
	{ dir: 'scripts/oxlint', checks: { tests: 'none' } },
	{ dir: 'packages/client/scripts/bench-android', checks: { tests: 'none' } },
];

/**
 * @description Loads every project the repo's checks know: each workspace with its manifest's `checks`,
 * plus the tooling directories outside the workspaces.
 * @returns The projects, sorted by directory so a parent precedes the projects inside it.
 */
export function loadProjects(): Project[] {
	const workspaces = [...loadWorkspaces().manifests].map(([dir, manifest]) => ({
		dir,
		checks: manifest.checks ?? {},
	}));
	const entries = [...workspaces, ...DIRECTORIES];
	const pluginRoots = entries.filter(({ checks }) => checks.plugins).map(({ dir }) => dir);

	return entries
		.map(({ dir, checks }) => ({
			dir,
			checks,
			typed: checks.typecheck !== false && existsSync(join(ROOT, dir, 'tsconfig.json')),
			plugin: pluginRoots.some((root) => dir.startsWith(`${root}/`)),
		}))
		.sort((a, b) => a.dir.localeCompare(b.dir));
}
