import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { DiscoveredAddon } from '../../src/lib/discovery';
import type { TempDir } from './ubd';

import { createCheckCache, type CheckContext } from '../../src/lib/check/check';
import { discoverAddons } from '../../src/lib/discovery';
import { loadWorkspace } from './config';

/**
 * @description Builds the context a check runs against, with fresh caches.
 * @param addon The addon to check.
 * @param emit Whether the checks write what they derive into the output.
 * @returns The context.
 */
export function checkContext(addon: DiscoveredAddon, emit = true): CheckContext {
	return { addon, emit, cache: createCheckCache() };
}

/**
 * @description Keeps the diagnostic lines of a printed report, without the colour CI forces, dropping blank lines and the summary.
 * @param output What `ubd build` or `ubd check` printed.
 * @returns The diagnostic lines, in order.
 */
export function reportLines(output: string): string[] {
	return Bun.stripANSI(output)
		.split('\n')
		.filter((line) => line.startsWith('error') || line.startsWith('warning'));
}

/**
 * @description Creates a temporary directory inside the repository, so oxlint resolves from its
 * `node_modules` the way it does for a real plugin.
 * @param files File contents by path relative to the directory.
 * @returns The directory and a function that deletes it.
 */
export function createRepoTempDir(files: Record<string, string>): TempDir {
	const path = mkdtempSync(join(import.meta.dir, '..', '.check-'));

	for (const [name, content] of Object.entries(files)) {
		mkdirSync(dirname(join(path, name)), { recursive: true });
		writeFileSync(join(path, name), content);
	}

	return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}

/**
 * @description Discovers the only addon of a test workspace.
 * @param dir The workspace.
 * @returns The addon; throws when the workspace has none.
 */
export async function onlyAddon(dir: TempDir): Promise<DiscoveredAddon> {
	const [addon] = await discoverAddons(loadWorkspace(dir.path));

	if (!addon) {
		throw new Error(`No addon was discovered in ${dir.path}.`);
	}

	return addon;
}

export default checkContext;
