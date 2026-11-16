import {
	CONFIG_FILENAME,
	findWorkspaceRoot,
	workspaceConfigSchema,
} from '@unbound-app/contracts/workspace';
import type { WorkspaceConfig } from '@unbound-app/contracts/workspace';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import toError from '@unbound-app/utils/to-error';
import { join, resolve } from 'node:path';

import { parse, safeParse } from './schema';

/** A parsed `unbound.config.json` paired with the directory it was found in (or defaulted into). */
export type ResolvedConfig = {
	config: WorkspaceConfig;
	dir: string;
	/** No config file was found, so `dir` is itself the single addon (the bare-addon shape). */
	bare: boolean;
};

const NESTED_SEARCH_SKIPS = new Set(['node_modules', 'dist', 'build']);

function childDirectories(dir: string): string[] {
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
			.filter((entry) => !NESTED_SEARCH_SKIPS.has(entry.name))
			.map((entry) => join(dir, entry.name));
	} catch {
		// An unreadable folder holds no workspace to find.
		return [];
	}
}

/**
 * @description Lists the workspaces up to two levels below a folder that is not itself an addon, such as a
 * monorepo root whose addons live in `packages/plugins` and `packages/themes`.
 * @param dir The folder to search from.
 * @returns The workspace roots, in path order; none for an addon folder.
 */
export function findNestedWorkspaces(dir: string): string[] {
	if (existsSync(join(dir, 'manifest.json'))) {
		return [];
	}

	const children = childDirectories(dir);

	return [...children, ...children.flatMap(childDirectories)]
		.filter((child) => existsSync(join(child, CONFIG_FILENAME)))
		.sort();
}

function onlyNestedWorkspace(dir: string): string | undefined {
	const nested = findNestedWorkspaces(dir);

	return nested.length === 1 ? nested[0] : undefined;
}

/**
 * @description Walks up from `cwd` looking for an `unbound.config.json`, parsing the first one found
 * against the config schema. With none above, the only workspace up to two levels below a folder that is not an
 * addon is used, so commands run from a monorepo root find it; otherwise the `cwd` is treated as a single-addon
 * root carrying the schema defaults, so bare addons need no config.
 * @param cwd The directory to start the upward search from.
 * @returns The parsed config and the directory it resolves relative to, or why the config is invalid.
 */
export function loadConfig(cwd: string = process.cwd()): ResolvedConfig | { error: string } {
	const root =
		findWorkspaceRoot(resolve(cwd), (dir) => existsSync(join(dir, CONFIG_FILENAME))) ??
		onlyNestedWorkspace(resolve(cwd));

	if (root === undefined) {
		return { config: parse(workspaceConfigSchema, {}), dir: resolve(cwd), bare: true };
	}

	const path = join(root, CONFIG_FILENAME);
	let json: unknown;

	try {
		json = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		return { error: `Invalid ${path}: ${toError(error).message}` };
	}

	const parsed = safeParse(workspaceConfigSchema, json);

	if (!parsed.success) {
		return { error: `Invalid ${path}:\n${parsed.error.message}` };
	}

	return { config: parsed.data, dir: root, bare: false };
}

export default loadConfig;
