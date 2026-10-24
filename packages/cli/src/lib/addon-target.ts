import { resolve } from 'node:path';

import { discoverAddons, type DiscoveredAddon } from '~/lib/discovery';
import { buildAddon } from '~/lib/build-addon';
import { loadConfig } from '~/lib/config';

export type AddonTarget = { addon: DiscoveredAddon } | { error: string };

/**
 * @description Finds a workspace addon by its id or directory and builds it unless asked not to.
 * @param target The addon's manifest id, or a path to its directory.
 * @param build Whether to run the workspace build command for it first.
 * @returns The addon, or the reason it could not be found or built.
 */
export async function resolveAddonTarget(target: string, build: boolean): Promise<AddonTarget> {
	const resolved = loadConfig();
	const addons = await discoverAddons(resolved);
	const directory = resolve(target);
	const addon = addons.find((entry) => entry.id === target || resolve(entry.dir) === directory);

	if (!addon) {
		return { error: `No addon in this workspace has the id or directory ${target}.` };
	}

	if (build && !(await buildAddon(addon, resolved.config.build))) {
		return { error: `Building ${addon.id} failed.` };
	}

	return { addon };
}

export default resolveAddonTarget;
