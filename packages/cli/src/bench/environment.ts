import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { defaulted, safeParse, Type } from '~/lib/schema';
const schema = Type.Object({
	DEV_HOST: Type.String({
		minLength: 1,
		errorMessage: 'DEV_HOST is unset: the address the vphone reaches this machine at',
	}),
	UNBOUND_BRIDGE_PORT: defaulted(Type.Integer({ minimum: 1 }), 9090),
	UNBOUND_BENCH_PORT: defaulted(Type.Integer({ minimum: 1 }), 3110),
	TAILNET_URL: Type.String({
		format: 'url',
		errorMessage:
			'TAILNET_URL is unset: the tailnet MCP hub that drives the vphone, such as http://<hub>:8790',
	}),
	TAILNET_CONNECTOR: Type.Optional(Type.String()),
	UNBOUND_BENCH_OUT: Type.Optional(Type.String()),
	UNBOUND_BENCH_URL: Type.Optional(Type.String()),
	UNBOUND_BENCH_CACHE: Type.Optional(Type.String()),
});

/** Where the bench runs: this machine's addresses, the vphone's hub, and where builds and reports go. */
export type BenchEnvironment = {
	devHost: string;
	bridgePort: number;
	benchPort: number;
	tailnetUrl: string;
	connector: string;
	out: string;
	publicUrl: string | undefined;
	cache: string;
};

/**
 * @description Reads a `.env` file's `KEY=value` lines, unquoting values.
 * @param text The file's text.
 * @returns The variables.
 */
export function parseDotEnv(text: string): Record<string, string> {
	const variables: Record<string, string> = {};

	for (const line of text.split('\n')) {
		const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());

		if (match) {
			variables[match[1]!] = match[2]!.replace(/^"(.*)"$/, '$1');
		}
	}

	return variables;
}

// Env values arrive as strings, so convert a port before the schema checks it, as `z.coerce` did.
function toPort(value: string | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

/**
 * @description Reads the bench's settings from the environment, falling back to the repo's gitignored `.env` as the
 * unbound-dev scripts do.
 * @param repo The repository root.
 * @returns The settings; throws naming each missing or invalid variable.
 */ export function benchEnvironment(repo: string): BenchEnvironment {
	const file = join(repo, '.env');
	const dotEnv = existsSync(file) ? parseDotEnv(readFileSync(file, 'utf8')) : {};
	const raw = { ...dotEnv, ...process.env };
	const parsed = safeParse(schema, {
		...raw,
		UNBOUND_BRIDGE_PORT: toPort(raw.UNBOUND_BRIDGE_PORT),
		UNBOUND_BENCH_PORT: toPort(raw.UNBOUND_BENCH_PORT),
	});

	if (!parsed.success) {
		throw new Error(
			`The bench needs these in the environment or ${file}:\n${parsed.error.message}`,
		);
	}

	const env = parsed.data;

	return {
		devHost: env.DEV_HOST,
		bridgePort: env.UNBOUND_BRIDGE_PORT,
		benchPort: env.UNBOUND_BENCH_PORT,
		tailnetUrl: env.TAILNET_URL,
		connector:
			env.TAILNET_CONNECTOR ??
			Bun.which('tailnet-connector') ??
			join(homedir(), '.cargo/bin/tailnet-connector'),
		out: env.UNBOUND_BENCH_OUT ?? join(repo, '.scratch/bench'),
		publicUrl: env.UNBOUND_BENCH_URL?.replace(/\/$/, ''),
		cache: env.UNBOUND_BENCH_CACHE ?? join(homedir(), '.cache/unbound-bench'),
	};
}

const REQUIRED_CHECKS = ['ok   debugger bridge', 'ok   device connected'];

/**
 * @description Runs the unbound-dev doctor. The bench needs the bridge and a connected Unbound; the doctor's other
 * checks (which checkout the dev server serves, the loader URL) describe the state the run snapshots and restores.
 * @param repo The repository root.
 * @param require Throw when a check the bench needs fails.
 * @returns The doctor's output, indented.
 */
export async function runDoctor(repo: string, require = true): Promise<string> {
	const child = Bun.spawn({
		cmd: ['bash', join(repo, '.agents/skills/unbound-dev/scripts/doctor.sh')],
		cwd: repo,
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [out, err] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	const text = (out + err).trim().replaceAll(/^/gm, '    ');

	if (
		require &&
		!REQUIRED_CHECKS.every((check) => out.split('\n').some((line) => line.startsWith(check)))
	) {
		throw new Error(
			`Failed to pass the doctor's bridge and device checks; fix them per SETUP.md:\n${text}`,
		);
	}

	return text;
}

export default { parseDotEnv, benchEnvironment, runDoctor };
