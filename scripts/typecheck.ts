import { parseArgs } from 'node:util';
import { resolve } from 'node:path';

import { loadProjects, ROOT } from './workspaces';
import { runCommand } from './run-command';

export type ProjectResult = { project: string; errors: string[] };

export type TypecheckSummary = { lines: string[]; ok: boolean };

/**
 * @description Lists the projects `bun run typecheck` checks: every typed one but the plugins, which
 * `plugins:typecheck` covers.
 * @returns Their directories, relative to the repository root.
 */
export function typecheckProjects(): string[] {
	return loadProjects()
		.filter((project) => project.typed && !project.plugin)
		.map((project) => project.dir);
}

export const TSC_ARGS = [
	'tsc',
	'--noEmit',
	'-p',
	'.',
	'--incremental',
	'--tsBuildInfoFile',
	'node_modules/.cache/typecheck.tsbuildinfo',
];

/**
 * @description Picks the compiler errors out of tsc output.
 * @param output The combined stdout and stderr of a tsc run.
 * @returns Each line that reports a type error.
 */
export function typeErrors(output: string): string[] {
	return output.split('\n').filter((line) => /error TS\d+/.test(line));
}

/**
 * @description Summarises a typecheck run, listing every error under the project it belongs to.
 * @param results One result per project.
 * @returns The report lines and whether every project passed.
 */
export function summarize(results: ProjectResult[]): TypecheckSummary {
	const failing = results.filter((result) => result.errors.length);
	const lines = failing.flatMap(({ project, errors }) =>
		errors.map((error) => `${project}/${error}`),
	);

	lines.push(
		failing.length
			? `${failing.length} of ${results.length} projects have type errors.`
			: `All ${results.length} projects type-check.`,
	);

	return { lines, ok: failing.length === 0 };
}

async function typecheck(project: string): Promise<ProjectResult> {
	const { code, output } = await runCommand(['bunx', ...TSC_ARGS], resolve(ROOT, project));
	const errors = typeErrors(output);

	return { project, errors: code !== 0 && !errors.length ? [output.trim()] : errors };
}

/**
 * @description Builds `@unbound-app/web`'s declaration files, which the projects importing it type-check against.
 * @returns Whether the build succeeded; its output is printed when it fails.
 */
export async function buildWebTypes(): Promise<boolean> {
	const types = await runCommand(
		['bun', 'run', '--filter', '@unbound-app/web', 'build:types'],
		ROOT,
	);

	if (types.code !== 0) {
		console.error(types.output);
	}

	return types.code === 0;
}

async function main(): Promise<void> {
	const { values } = parseArgs({ options: { 'web-types-built': { type: 'boolean' } } });

	if (!values['web-types-built'] && !(await buildWebTypes())) {
		process.exitCode = 1;

		return;
	}

	const queue = typecheckProjects();
	const results: ProjectResult[] = [];
	const workers = Array.from({ length: Math.max(1, navigator.hardwareConcurrency) }, async () => {
		for (let project = queue.shift(); project; project = queue.shift()) {
			results.push(await typecheck(project));
		}
	});

	await Promise.all(workers);

	const { lines, ok } = summarize(results.sort((a, b) => a.project.localeCompare(b.project)));

	for (const line of lines) {
		(ok ? console.log : console.error)(line);
	}

	if (!ok) {
		process.exitCode = 1;
	}
}

if (import.meta.main) {
	await main();
}
