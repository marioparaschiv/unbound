import picomatch from 'picomatch';
import { z } from 'zod';

/** The workspace config's filename; the directory holding one is a workspace root. */
export const CONFIG_FILENAME = 'unbound.config.json';

/** The validated shape of an `unbound.config.json`. */
export const workspaceConfigSchema = z.object({
	$schema: z.string().optional(),
	addons: z.array(z.string()).default(['plugins/*', 'themes/*']),
	build: z.string().default('bun run build'),
	output: z.string().default('dist'),
});

export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;

export type AddonKind = 'plugin' | 'theme';

/** An addon found in a workspace. Paths are `/`-separated and relative to the root `files` reads from. */
export type WorkspaceAddon = {
	id: string;
	kind: AddonKind;
	/** The addon's directory; `''` is the root itself. */
	path: string;
	/** A static addon has no `package.json` build script, so its files ship as-is. */
	static: boolean;
	/** The file that ships: `{path}/{main}` when static, `{path}/{output}/{bundleName}` when built. */
	bundle: string;
};

/** A directory the workspace registers that is not an addon, and why. */
export type SkippedDirectory = {
	path: string;
	reason: string;
};

/** Reads a file by its `/`-separated path: from disk in the CLI, from a git tree on the server. */
export type WorkspaceFiles = {
	read(path: string): string | undefined;
};

type ManifestFields = {
	id?: unknown;
	main?: unknown;
};

type PackageFields = {
	scripts?: Record<string, string>;
};

/**
 * @description Picks, out of the directories holding a `manifest.json`, the ones the workspace registers.
 * @param config The workspace config.
 * @param bare No config file exists, so the root itself is the only addon directory.
 * @param candidateDirs Directories holding a `manifest.json`, `/`-separated, relative to the workspace root.
 * @returns The registered directories, sorted and without duplicates.
 */
export function matchAddonDirs(
	config: WorkspaceConfig,
	bare: boolean,
	candidateDirs: string[],
): string[] {
	if (bare) {
		return candidateDirs.includes('') ? [''] : [];
	}

	const isMatch = picomatch(config.addons);

	return [...new Set(candidateDirs.filter((dir) => isMatch(dir)))].sort();
}

/**
 * @description Reads one registered directory as an addon: it needs a `manifest.json` with string `id`
 * and `main`, a `.json` main makes it a theme, and no `package.json` build script makes it static.
 * @param dir The directory, `/`-separated; `''` is the root.
 * @param files Reads the directory's files.
 * @param config The workspace config, for `output`.
 * @returns The addon, or why the directory is not one.
 */
export function readAddon(
	dir: string,
	files: WorkspaceFiles,
	config: WorkspaceConfig,
): WorkspaceAddon | SkippedDirectory {
	const text = files.read(joinPath(dir, 'manifest.json'));

	if (text === undefined) {
		return { path: dir, reason: 'it has no manifest.json' };
	}

	let manifest: ManifestFields | null;

	try {
		manifest = JSON.parse(text);
	} catch (error) {
		return { path: dir, reason: `its manifest.json could not be read: ${String(error)}` };
	}

	if (typeof manifest?.id !== 'string' || typeof manifest.main !== 'string') {
		return { path: dir, reason: 'its manifest.json has no string "id" and "main"' };
	}

	const isStatic = !hasBuildScript(files.read(joinPath(dir, 'package.json')));
	const bundleName = getBundleName(isStatic, manifest.main);

	return {
		id: manifest.id,
		kind: manifest.main.endsWith('.json') ? 'theme' : 'plugin',
		path: dir,
		static: isStatic,
		bundle: isStatic ? joinPath(dir, bundleName) : joinPath(dir, config.output, bundleName),
	};
}

/**
 * @description Tells an addon from a skipped directory in {@link readAddon}'s result.
 * @param result The result of {@link readAddon}.
 * @returns Whether the directory is an addon.
 */
export function isWorkspaceAddon(
	result: WorkspaceAddon | SkippedDirectory,
): result is WorkspaceAddon {
	return 'id' in result;
}

/**
 * @description Names an addon's bundle inside its output directory. A static addon ships the file
 * named by `main` as-is; a built addon's bundle is the JavaScript its build emits for `main`.
 * @param isStatic Whether the addon ships its files as-is.
 * @param main The manifest's `main`.
 * @returns The bundle's path relative to the output directory, which is also the published `main`.
 */
export function getBundleName(isStatic: boolean, main: string): string {
	if (isStatic) {
		return main;
	}

	const name = main.slice(main.lastIndexOf('/') + 1);

	return name.replace(/\.\w+$/, '.js');
}

/**
 * @description Walks up from `dir` to the nearest directory holding a workspace config.
 * @param dir The starting directory: absolute on disk, or `/`-separated and relative in a git tree.
 * @param hasConfig Whether a directory holds an `unbound.config.json`.
 * @returns The workspace root, or `undefined` when there is none and `dir` is a bare addon.
 */
export function findWorkspaceRoot(
	dir: string,
	hasConfig: (dir: string) => boolean,
): string | undefined {
	let current: string | undefined = dir;

	while (current !== undefined) {
		if (hasConfig(current)) {
			return current;
		}

		current = getParentDir(current);
	}

	return void 0;
}

// Handles both frames `findWorkspaceRoot` walks: absolute disk paths stop at `/` or `C:\`, relative
// tree paths stop after `''`.
function getParentDir(dir: string): string | undefined {
	if (dir === '') return;

	const index = Math.max(dir.lastIndexOf('/'), dir.lastIndexOf('\\'));

	if (index === -1) {
		return '';
	}

	if (index === dir.length - 1) return;

	const parent = dir.slice(0, index);

	return parent === '' || parent.endsWith(':') ? dir.slice(0, index + 1) : parent;
}

function joinPath(...parts: string[]): string {
	const segments: string[] = [];

	for (const segment of parts.join('/').split('/')) {
		if (segment === '' || segment === '.') {
			continue;
		}

		if (segment === '..') {
			segments.pop();
		} else {
			segments.push(segment);
		}
	}

	return segments.join('/');
}

function hasBuildScript(text: string | undefined): boolean {
	if (text === undefined) {
		return false;
	}

	try {
		const pkg: PackageFields | null = JSON.parse(text);

		return Boolean(pkg?.scripts?.build);
	} catch {
		return false;
	}
}

export default {
	CONFIG_FILENAME,
	workspaceConfigSchema,
	matchAddonDirs,
	readAddon,
	isWorkspaceAddon,
	getBundleName,
	findWorkspaceRoot,
};
