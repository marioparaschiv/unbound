import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { glob } from 'node:fs/promises';

import type { ResolvedConfig } from '~/lib/config';

/** A discovered addon: where it lives, what kind it is, and how to build and reload it. */
export type DiscoveredAddon = {
	id: string;
	kind: 'plugin' | 'theme';
	dir: string;
	/** The resolved output path; the addon directory itself for static addons. */
	output: string;
	/** A static addon has no `package.json` build script, so its files ship as-is. */
	static: boolean;
};

/**
 * @description Discovers every addon reachable through the config's `addons` globs. A directory is an
 * addon iff it contains a `manifest.json`; its kind is derived from the manifest `main` (a `.json`
 * entry point is a theme, anything else a plugin) and it is static when its directory carries no
 * `package.json` with a `build` script.
 * @param resolved The loaded config paired with the directory its globs resolve relative to.
 * @returns Every discovered addon, keyed implicitly by directory.
 */
export async function discoverAddons(resolved: ResolvedConfig): Promise<DiscoveredAddon[]> {
	const { config, dir, bare } = resolved;

	const dirs = new Set<string>();

	if (bare) {
		dirs.add(dir);
	} else {
		for (const pattern of config.addons) {
			for await (const match of glob(pattern, { cwd: dir })) {
				dirs.add(resolve(dir, match));
			}
		}
	}

	const addons: DiscoveredAddon[] = [];

	for (const addonDir of dirs) {
		const addon = readAddon(addonDir, config.output);
		if (addon) addons.push(addon);
	}

	return addons;
}

/**
 * @description Reads a single directory as an addon, returning `undefined` when it has no
 * `manifest.json` or the manifest lacks the fields discovery needs.
 * @param addonDir The absolute directory to inspect.
 * @param output The config's output directory, relative to the addon.
 * @returns The discovered addon, or `undefined` if the directory is not an addon.
 */
export function readAddon(addonDir: string, output: string): DiscoveredAddon | undefined {
	const manifestPath = join(addonDir, 'manifest.json');
	if (!existsSync(manifestPath)) return void 0;

	let manifest: { id?: unknown; main?: unknown };

	try {
		manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	} catch (error) {
		process.stderr.write(
			`Skipping ${addonDir}: its manifest.json could not be read: ${error}\n`,
		);
		return void 0;
	}

	if (typeof manifest.id !== 'string' || typeof manifest.main !== 'string') return void 0;

	const kind = manifest.main.endsWith('.json') ? 'theme' : 'plugin';
	const isStatic = !hasBuildScript(addonDir);

	return {
		id: manifest.id,
		kind,
		dir: addonDir,
		output: isStatic ? addonDir : join(addonDir, output),
		static: isStatic,
	};
}

function hasBuildScript(addonDir: string): boolean {
	const packagePath = join(addonDir, 'package.json');
	if (!existsSync(packagePath)) return false;

	try {
		const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));

		return Boolean(pkg.scripts?.build);
	} catch {
		return false;
	}
}

export default discoverAddons;
