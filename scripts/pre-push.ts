import { resolve } from 'node:path';

import type { Project } from './workspaces';

import { buildWebTypes, TSC_ARGS } from './typecheck';
import { loadProjects, ROOT } from './workspaces';
import { runCommand } from './run-command';

export type Check = { label: string; cwd: string; command: string[] };

// A bare `bun test` in the plugins root runs every plugin's tests in one process, where mocks leak.
const ALL_PLUGINS: Check[] = [
	{ label: 'plugin tests', cwd: '.', command: ['bun', 'run', 'plugins:test'] },
	{ label: 'plugin type-check', cwd: '.', command: ['bun', 'run', 'plugins:typecheck'] },
];
const SKIPPED = ['packages/loader/', 'docs/', '.github/'];
const LOADER_LINTED = ['packages/loader/', '.github/'];
const LOADER_LINT: Check = {
	label: 'loader lint',
	cwd: 'packages/loader',
	command: ['go', 'run', './tools', 'lint'],
};

function projectChecks({ dir, checks, typed }: Project): Check[] {
	const found: Check[] = [];

	if (checks.tests !== 'none') {
		const command =
			checks.tests === 'parallel' ? ['bun', 'test', '--parallel'] : ['bun', 'test'];

		found.push({ label: `${dir} tests`, cwd: dir, command });
	}

	if (typed) {
		found.push({ label: `${dir} type-check`, cwd: dir, command: ['bunx', ...TSC_ARGS] });
	}

	return found;
}

/**
 * @description Works out which tests and type-checks a set of changed files needs: those of every
 * project containing a file, and every plugin's when the innermost one is a `plugins` workspace.
 * @param files Changed file paths, relative to the repository root.
 * @param projects The projects, parents before the projects inside them, as `loadProjects` returns.
 * @returns The checks to run, without duplicates.
 */
export function checksFor(files: string[], projects: Project[]): Check[] {
	const checks = new Map<string, Check>();
	const add = (check: Check) => checks.set(`${check.cwd} ${check.command.join(' ')}`, check);

	for (const file of files) {
		if (LOADER_LINTED.some((prefix) => file.startsWith(prefix)) && !/\.mdx?$/.test(file)) {
			add(LOADER_LINT);
		}

		if (SKIPPED.some((prefix) => file.startsWith(prefix))) {
			continue;
		}

		const containing = projects.filter((project) => file.startsWith(`${project.dir}/`));

		if (containing.at(-1)?.checks.plugins) {
			for (const check of ALL_PLUGINS) add(check);
		}

		for (const check of containing.flatMap(projectChecks)) add(check);
	}

	return [...checks.values()];
}

async function changedFiles(): Promise<string[]> {
	const diff = Bun.spawn(['git', 'diff', '--name-only', 'origin/main...HEAD'], {
		cwd: ROOT,
		stdout: 'pipe',
	});
	const output = await new Response(diff.stdout).text();

	await diff.exited;

	return output.split('\n').filter(Boolean);
}

// Git exports `GIT_DIR` and friends to its hooks; tests that create their own repositories must not inherit them.
function checkEnv(): Record<string, string | undefined> {
	return Object.fromEntries(
		Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
	);
}

const NO_TESTS = /No tests found|\b0 test files matching/;

async function runCheck(check: Check): Promise<boolean> {
	const { code, output } = await runCommand(check.command, resolve(ROOT, check.cwd), checkEnv());
	const passed = code === 0 || NO_TESTS.test(output);

	if (!passed) {
		console.error(`✗ ${check.label}\n${output.trim().split('\n').slice(-30).join('\n')}`);
	}

	return passed;
}

async function main(): Promise<void> {
	const checks = checksFor(await changedFiles(), loadProjects());

	if (!checks.length) {
		return;
	}

	console.log(`Running ${checks.length} checks for the pushed changes…`);

	// Projects importing `@unbound-app/web` type-check against its built declarations, as `bun run typecheck` does.
	if (checks.some((check) => check.command.includes('tsc')) && !(await buildWebTypes())) {
		console.error('Push stopped: building the web types failed.');
		process.exitCode = 1;

		return;
	}

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
