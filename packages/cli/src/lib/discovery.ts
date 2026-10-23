import { isWorkspaceAddon, matchAddonDirs, readAddon } from '@unbound-app/contracts/workspace';
import type { WorkspaceAddon, WorkspaceFiles } from '@unbound-app/contracts/workspace';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix, sep } from 'node:path';
import { glob } from 'node:fs/promises';

import type { ResolvedConfig } from '~/lib/config';

/** A discovered addon, plus the absolute paths the CLI builds, watches and reads it through. */
export type DiscoveredAddon = WorkspaceAddon & {
	dir: string;
	/** The resolved output path; the addon directory itself for static addons. */
	output: string;
};

const IGNORED_SEGMENTS = new Set(['node_modules', '.git']);

/**
 * @description Discovers every addon the workspace registers, by the shared rules in
 * `@unbound-app/contracts/workspace`. A registered directory that is not an addon is reported on
 * stderr and skipped.
 * @param resolved The loaded config paired with the directory its globs resolve relative to.
 * @returns Every discovered addon.
 */
export async function discoverAddons(resolved: ResolvedConfig): Promise<DiscoveredAddon[]> {
	const { config, dir: root, bare } = resolved;

	const files: WorkspaceFiles = {
		read(path) {
			const absolute = join(root, path);

			return existsSync(absolute) ? readFileSync(absolute, 'utf8') : void 0;
		},
	};

	const candidates = bare ? listBareCandidates(root) : await listManifestDirs(root);
	const addons: DiscoveredAddon[] = [];

	for (const path of matchAddonDirs(config, bare, candidates)) {
		const result = readAddon(path, files, config);
		const dir = join(root, path);

		if (!isWorkspaceAddon(result)) {
			process.stderr.write(`Skipping ${dir}: ${result.reason}\n`);

			continue;
		}

		addons.push({ ...result, dir, output: result.static ? dir : join(dir, config.output) });
	}

	return addons;
}

function listBareCandidates(root: string): string[] {
	return existsSync(join(root, 'manifest.json')) ? [''] : [];
}

async function listManifestDirs(root: string): Promise<string[]> {
	const dirs: string[] = [];

	for await (const match of glob('**/manifest.json', { cwd: root, exclude: isIgnored })) {
		const dir = posix.dirname(match.split(sep).join('/'));

		dirs.push(dir === '.' ? '' : dir);
	}

	return dirs;
}

function isIgnored(path: string): boolean {
	return path.split(sep).some((segment) => IGNORED_SEGMENTS.has(segment));
}

export default discoverAddons;
