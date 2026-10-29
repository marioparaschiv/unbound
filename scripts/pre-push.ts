import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { PROJECTS, TSC_ARGS } from './typecheck';

export type Check = { label: string; cwd: string; command: string[] };

const root = resolve(import.meta.dir, '..');
const ALL_PLUGINS: Check[] = [
	{ label: 'plugin tests', cwd: '.', command: ['bun', 'run', 'plugins:test'] },
	{ label: 'plugin type-check', cwd: '.', command: ['bun', 'run', 'plugins:typecheck'] },
];
const UNTESTED = new Set(['apps/web', 'apps/discord-bot']);
const SKIPPED = ['packages/loader/', 'docs/', '.github/'];

function projectOf(file: string): string | undefined {
	const plugin = /^packages\/plugins\/([^/]+)\//.exec(file);

	if (plugin) {
		return `packages/plugins/${plugin[1]}`;
	}

	const workspace = /^(packages|apps)\/([^/]+)\//.exec(file);

	if (workspace) {
		return `${workspace[1]}/${workspace[2]}`;
	}

	return file.startsWith('scripts/') ? 'scripts' : undefined;
}

/**
 * @description Works out which tests and type-checks a set of changed files needs.
 * @param files Changed file paths, relative to the repository root.
 * @param exists Whether a path relative to the root exists.
 * @returns The checks to run, without duplicates.
 */
export function checksFor(files: string[], exists: (path: string) => boolean): Check[] {
	const checks = new Map<string, Check>();
	const add = (check: Check) => checks.set(`${check.cwd} ${check.command.join(' ')}`, check);

	for (const file of files) {
		if (SKIPPED.some((prefix) => file.startsWith(prefix))) {
			continue;
		}

		const project = projectOf(file);

		if (!project) {
			continue;
		}

		if (project === 'packages/plugins-shared') {
			for (const check of ALL_PLUGINS) add(check);
		}

		if (project.startsWith('packages/plugins/')) {
			if (!exists(`${project}/package.json`)) {
				continue;
			}

			add({ label: `${project} tests`, cwd: project, command: ['bun', 'test'] });

			if (exists(`${project}/tsconfig.json`)) {
				add({
					label: `${project} type-check`,
					cwd: project,
					command: ['bunx', ...TSC_ARGS],
				});
			}

			continue;
		}

		if (!UNTESTED.has(project) && exists(`${project}/package.json`)) {
			add({ label: `${project} tests`, cwd: project, command: ['bun', 'test'] });
		}

		if (PROJECTS.includes(project)) {
			add({ label: `${project} type-check`, cwd: project, command: ['bunx', ...TSC_ARGS] });
		}
	}

	return [...checks.values()];
}

async function changedFiles(): Promise<string[]> {
	const diff = Bun.spawn(['git', 'diff', '--name-only', 'origin/main...HEAD'], {
		cwd: root,
		stdout: 'pipe',
	});
	const output = await new Response(diff.stdout).text();

	await diff.exited;

	return output.split('\n').filter(Boolean);
}

async function runCheck(check: Check): Promise<boolean> {
	const child = Bun.spawn(check.command, {
		cwd: resolve(root, check.cwd),
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	const passed = code === 0 || /No tests found/.test(stdout + stderr);

	if (!passed) {
		console.error(
			`✗ ${check.label}\n${(stdout + stderr).trim().split('\n').slice(-30).join('\n')}`,
		);
	}

	return passed;
}

async function main(): Promise<void> {
	const checks = checksFor(await changedFiles(), (path) => existsSync(resolve(root, path)));

	if (!checks.length) {
		return;
	}

	console.log(`Running ${checks.length} checks for the pushed changes…`);

	const results = await Promise.all(checks.map(runCheck));

	if (results.every(Boolean)) {
		console.log('All pushed changes pass their tests and type-check.');

		return;
	}

	console.error('Push stopped: fix the failures above, or push with --no-verify to skip.');
	process.exitCode = 1;
}

if (import.meta.main) {
	await main();
}
