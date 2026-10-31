import { parseArgs } from 'node:util';
import { resolve } from 'node:path';

export type ProjectResult = { project: string; errors: string[] };

export type TypecheckSummary = { lines: string[]; ok: boolean };

type CommandResult = { code: number; output: string };

const root = resolve(import.meta.dir, '..');

export const PROJECTS = [
	'apps/web',
	'apps/discord-bot',
	'packages/cli',
	'packages/client',
	'packages/plugin-scripts',
	'packages/api',
	'packages/contracts',
	'packages/debugger',
	'packages/debugger-protocol',
	'packages/logger',
	'packages/plugin-test',
	'packages/plugins-shared',
	'packages/types',
	'packages/utils',
	'scripts',
];

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

async function run(command: string[], cwd: string): Promise<CommandResult> {
	const child = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	return { code, output: stdout + stderr };
}

async function typecheck(project: string): Promise<ProjectResult> {
	const { code, output } = await run(['bunx', ...TSC_ARGS], resolve(root, project));
	const errors = typeErrors(output);

	return { project, errors: code !== 0 && !errors.length ? [output.trim()] : errors };
}

async function buildWebTypes(): Promise<boolean> {
	const types = await run(['bun', 'run', '--filter', '@unbound-app/web', 'build:types'], root);

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

	const queue = [...PROJECTS];
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
