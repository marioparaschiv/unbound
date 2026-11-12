import type { CommandErrorCode } from '@unbound-app/debugger-protocol/registry';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { discoverAddons, type DiscoveredAddon } from '~/lib/discovery';
import { DEV_BUILD_CHECKS } from '~/lib/build-checks';
import { buildAddon } from '~/lib/build-addon';
import { loadConfig } from '~/lib/config';

/** The addon, or why it could not be found (`not-found`) or built (no code). */
export type AddonTarget = { addon: DiscoveredAddon } | { error: string; code?: CommandErrorCode };

export type AddonTargetOptions = {
	/** Whether to run the workspace build command for it first. */
	build: boolean;
	/** Build it for a running client to hot-reload. */
	hot?: boolean;
	/** How long the build may run before it fails; unbounded when omitted. */
	timeoutMs?: number;
};

/**
 * @description Finds a workspace addon by its id or directory and builds it unless asked not to. A directory is looked up in the workspace that holds it, so it resolves from any working directory.
 * @param target The addon's manifest id, or a path to its directory.
 * @param options Whether and how to build it.
 * @returns The addon, or the reason it could not be found or built.
 */
export async function resolveAddonTarget(
	target: string,
	{ build, hot, timeoutMs }: AddonTargetOptions,
): Promise<AddonTarget> {
	const directory = resolve(target);
	const resolved = loadConfig(existsSync(directory) ? directory : void 0);

	if ('error' in resolved) {
		return resolved;
	}

	const addons = await discoverAddons(resolved);
	const addon = addons.find((entry) => entry.id === target || resolve(entry.dir) === directory);

	if (!addon) {
		return {
			error: `No addon in this workspace has the id or directory ${target}.`,
			code: 'not-found',
		};
	}

	if (!build) {
		return { addon };
	}

	const built = await buildAddon(addon, {
		command: resolved.config.build,
		hot,
		checks: DEV_BUILD_CHECKS,
		timeoutMs,
	});

	if (!built.ok) {
		return { error: `Building ${addon.id} failed.` };
	}

	return { addon };
}

export default resolveAddonTarget;
