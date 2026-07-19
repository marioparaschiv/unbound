import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

import type { CreateOptions } from '~/lib/create-prompts';
import type { Kind, Tokens } from '~/lib/templates';
import type { ResolvedConfig } from '~/lib/config';
import { scaffoldTemplate } from '~/lib/scaffold';
import { templatePath } from '~/lib/templates';

/** What `scaffold` produces, so the caller can print the next-step outro. */
export type ScaffoldResult = {
	dir: string;
	kind: Kind;
	name: string;
};

/**
 * @description Scaffolds the chosen shape into a validated target directory: a repository stamps the
 * workspace template then the starter addon under `plugins/`/`themes/`; a single addon or an addon
 * added to an existing workspace stamps only the kind's template. Runs `git init` and `bun install`
 * for repositories when confirmed.
 * @param options The fully-resolved create options.
 * @param workspace The config found in or above the cwd, or `undefined` when none exists.
 * @returns Where the addon landed, for the next-step outro.
 */
export function scaffold(
	options: CreateOptions,
	workspace: ResolvedConfig | undefined,
): ScaffoldResult {
	const tokens = toTokens(options);

	if (options.shape === 'repository') return scaffoldRepository(options, tokens);
	if (options.shape === 'add') return scaffoldWorkspaceAddon(options, tokens, workspace);

	return scaffoldBareAddon(options, tokens);
}

function scaffoldRepository(options: CreateOptions, tokens: Tokens): ScaffoldResult {
	const dir = resolve(options.dir ?? `./${options.name}`);

	assertEmpty(dir);

	scaffoldTemplate(templatePath('repository'), dir, tokens);

	const folder = options.kind === 'plugin' ? 'plugins' : 'themes';
	scaffoldTemplate(templatePath(options.kind), join(dir, folder, options.name), tokens);

	if (options.gitInit) gitInit(dir);
	if (options.install) bunInstall(dir);

	return { dir, kind: options.kind, name: options.name };
}

function scaffoldBareAddon(options: CreateOptions, tokens: Tokens): ScaffoldResult {
	const dir = resolve(options.dir ?? `./${options.name}`);

	assertEmpty(dir);

	scaffoldTemplate(templatePath(options.kind), dir, tokens);

	return { dir, kind: options.kind, name: options.name };
}

function scaffoldWorkspaceAddon(
	options: CreateOptions,
	tokens: Tokens,
	workspace: ResolvedConfig | undefined,
): ScaffoldResult {
	if (!workspace) throw new Error('Cannot add an addon: no workspace config was found.');

	const dir = join(workspaceAddonDir(workspace, options.kind), options.name);

	assertEmpty(dir);

	scaffoldTemplate(templatePath(options.kind), dir, tokens);

	return { dir, kind: options.kind, name: options.name };
}

/**
 * @description Picks the workspace directory a new addon of the given kind belongs in, matching the
 * config `addons` glob whose leading segment names the kind and stripping its trailing `*` segment.
 * Falls back to `plugins`/`themes` next to the config when no glob matches.
 * @param workspace The resolved workspace config.
 * @param kind The addon kind being added.
 * @returns The absolute directory the addon folder should be created under.
 */
function workspaceAddonDir(workspace: ResolvedConfig, kind: Kind): string {
	const keyword = kind === 'plugin' ? 'plugin' : 'theme';

	const glob = workspace.config.addons.find((pattern) => pattern.includes(keyword));
	const base = glob ? glob.replace(/\/?\*+.*$/, '') : `${keyword}s`;

	return resolve(workspace.dir, base);
}

function assertEmpty(dir: string): void {
	if (!existsSync(dir)) return;

	if (readdirSync(dir).length > 0) {
		throw new Error(`Target directory is not empty: ${dir}`);
	}
}

function gitInit(dir: string): void {
	spawnSync('git', ['init'], { cwd: dir, stdio: 'inherit' });
}

function bunInstall(dir: string): void {
	spawnSync('bun', ['install'], { cwd: dir, stdio: 'inherit' });
}

function toTokens(options: CreateOptions): Tokens {
	return {
		name: options.name,
		id: options.id,
		displayName: options.displayName,
		description: options.description,
		authorName: options.authorName,
		authorId: options.authorId,
		main: options.kind === 'theme' ? 'theme' : 'index.tsx',
	};
}

export default scaffold;
