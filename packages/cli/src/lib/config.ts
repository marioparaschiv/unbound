import {
	CONFIG_FILENAME,
	findWorkspaceRoot,
	workspaceConfigSchema,
} from '@unbound-app/contracts/workspace';
import type { WorkspaceConfig } from '@unbound-app/contracts/workspace';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** A parsed `unbound.config.json` paired with the directory it was found in (or defaulted into). */
export type ResolvedConfig = {
	config: WorkspaceConfig;
	dir: string;
	/** No config file was found, so `dir` is itself the single addon (the bare-addon shape). */
	bare: boolean;
};

/**
 * @description Walks up from `cwd` looking for an `unbound.config.json`, parsing the first one found
 * against the config schema. When none exists the `cwd` is treated as a single-addon root carrying
 * the schema defaults, so bare addons need no config.
 * @param cwd The directory to start the upward search from.
 * @returns The parsed config and the directory it resolves relative to.
 */
export function loadConfig(cwd: string = process.cwd()): ResolvedConfig {
	const root = findWorkspaceRoot(resolve(cwd), (dir) => existsSync(join(dir, CONFIG_FILENAME)));

	if (root === undefined) {
		return { config: workspaceConfigSchema.parse({}), dir: resolve(cwd), bare: true };
	}

	const raw = JSON.parse(readFileSync(join(root, CONFIG_FILENAME), 'utf8'));
	const config = workspaceConfigSchema.parse(raw);

	return { config, dir: root, bare: false };
}

export default loadConfig;
