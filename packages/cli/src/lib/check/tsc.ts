import { dirname, join } from 'node:path';

import type { Severity } from '~/lib/check/diagnostic';

/** One problem as `tsc --pretty false` prints it; `file` is relative to the directory tsc ran in. */
export type TscDiagnostic = {
	file: string | undefined;
	line: number | undefined;
	column: number | undefined;
	severity: Severity;
	code: number;
	message: string;
};

/** The result of one tsc run: its diagnostics, or its raw output when it failed without any. */
export type TscResult = { diagnostics: TscDiagnostic[]; failure: string | undefined };

// `src/a.ts(1,14): error TS2322: Type …`, or `error TS5058: …` for a problem outside any file.
const DIAGNOSTIC = /^(?:(.+)\((\d+),(\d+)\): )?(error|warning) TS(\d+): (.*)$/;

/**
 * @description Reads the diagnostics out of `tsc --pretty false` output, joining each message's indented follow-up lines.
 * @param output The combined stdout and stderr of a tsc run.
 * @returns One diagnostic per reported problem, in order.
 */
export function parseTscOutput(output: string): TscDiagnostic[] {
	const found: TscDiagnostic[] = [];

	for (const text of output.split('\n')) {
		const match = DIAGNOSTIC.exec(text);
		const previous = found.at(-1);

		if (match) {
			const [, file, line, column, severity, code, message] = match;

			found.push({
				file,
				line: line ? Number(line) : void 0,
				column: column ? Number(column) : void 0,
				severity: severity === 'warning' ? 'warning' : 'error',
				code: Number(code),
				message: message ?? '',
			});
		} else if (previous && text.startsWith(' ')) {
			previous.message += `\n${text.trimEnd()}`;
		}
	}

	return found;
}

/**
 * @description Runs the TypeScript 7 compiler the CLI depends on, so a check matches `tsc` whatever an addon installs.
 * @param args The arguments after `tsc`; `--pretty false` is added.
 * @param cwd The directory to run in; reported files are relative to it.
 * @returns The diagnostics, and the output when tsc failed without reporting any.
 */
export async function runTsc(args: readonly string[], cwd: string): Promise<TscResult> {
	const tsc = join(
		dirname(Bun.resolveSync('typescript/package.json', import.meta.dir)),
		'bin',
		'tsc',
	);
	const child = Bun.spawn([process.execPath, tsc, ...args, '--pretty', 'false'], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	const output = stdout + stderr;
	const diagnostics = parseTscOutput(output);

	return { diagnostics, failure: code !== 0 && !diagnostics.length ? output.trim() : void 0 };
}

export default { parseTscOutput, runTsc };
