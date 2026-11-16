import { loadConfig, findNestedWorkspaces, type ResolvedConfig } from '~/lib/config';
import { discoverAddons, type DiscoveredAddon } from '~/lib/discovery';
import { unknownAddonNames } from '~/lib/addon-filter';

/** A workspace and the addons discovered in it. */
export type AddonWorkspace = { resolved: ResolvedConfig; addons: DiscoveredAddon[] };

/**
 * @description Loads the workspace that holds the named addons: the one around `cwd`, or, when it lacks them, the
 * first workspace below `cwd` that has them all, so `ubd build <id>` works from a monorepo root.
 * @param names The addon ids or directories asked for; any workspace serves when empty.
 * @param cwd The folder the command runs in.
 * @returns The workspace and its addons, or why its config is invalid.
 */
export async function loadAddonWorkspace(
	names: readonly string[],
	cwd: string = process.cwd(),
): Promise<AddonWorkspace | { error: string }> {
	const resolved = loadConfig(cwd);

	if ('error' in resolved) {
		return resolved;
	}

	const addons = await discoverAddons(resolved);

	if (unknownAddonNames(addons, names).length === 0) {
		return { resolved, addons };
	}

	for (const dir of findNestedWorkspaces(cwd)) {
		const nested = loadConfig(dir);

		if ('error' in nested) {
			continue;
		}

		const found = await discoverAddons(nested);

		if (unknownAddonNames(found, names).length === 0) {
			return { resolved: nested, addons: found };
		}
	}

	return { resolved, addons };
}

export default loadAddonWorkspace;
