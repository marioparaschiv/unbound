import { spawn } from 'node:child_process';

export type CommandResult = { ok: true; stdout: string } | { ok: false; error: string };

export type CommandRunner = (
	command: string,
	args: string[],
	timeoutMs: number,
) => Promise<CommandResult>;

const OUTPUT_DRAIN_MS = 500;

/**
 * @description Runs a program to completion and captures its output, killing it once the timeout
 * elapses. A program that exits while a child it forked still holds its output open, as `adb` does
 * when it starts its server, resolves shortly after it exits instead of waiting on that child.
 * @param command The program to run.
 * @param args Its arguments.
 * @param timeoutMs How long it may run before it is killed and reported as timed out.
 * @returns Its stdout when it exits cleanly, or why it failed.
 */
export function runCommand(
	command: string,
	args: string[],
	timeoutMs: number,
): Promise<CommandResult> {
	return new Promise((resolve) => {
		const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		const label = [command, findSubcommand(args)].filter(Boolean).join(' ');

		let stdout = '';
		let stderr = '';
		let settled = false;
		let drain: ReturnType<typeof setTimeout> | undefined;

		function settle(result: CommandResult) {
			if (settled) return;

			settled = true;
			clearTimeout(timer);
			clearTimeout(drain);
			child.stdout.destroy();
			child.stderr.destroy();
			resolve(result);
		}

		function finish(code: number | null, signal: NodeJS.Signals | null) {
			if (code === 0) {
				settle({ ok: true, stdout });

				return;
			}

			const output = (stderr || stdout).trim();
			const reason = signal ? `was killed by ${signal}` : `exited with code ${code}`;

			settle({
				ok: false,
				error: output ? `${label} failed: ${output}` : `${label} ${reason}.`,
			});
		}

		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			settle({ ok: false, error: `${label} timed out after ${formatDuration(timeoutMs)}.` });
		}, timeoutMs);

		child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
		child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));

		child.on('error', (error: NodeJS.ErrnoException) => {
			settle({
				ok: false,
				error:
					error.code === 'ENOENT'
						? `${command} was not found. Install it or add it to your PATH.`
						: `${label} could not start: ${error.message}`,
			});
		});

		child.on('exit', (code, signal) => {
			drain = setTimeout(() => finish(code, signal), OUTPUT_DRAIN_MS);
		});

		child.on('close', (code, signal) => finish(code, signal));
	});
}

function findSubcommand(args: string[]): string | undefined {
	for (let index = 0; index < args.length; index++) {
		if (!args[index]?.startsWith('-')) {
			return args[index];
		}

		index++;
	}
}

/**
 * @description Renders a millisecond duration for a timeout message.
 * @param ms The duration in milliseconds.
 * @returns The duration in seconds when it is whole seconds, otherwise in milliseconds.
 */
export function formatDuration(ms: number): string {
	return ms >= 1000 && ms % 1000 === 0 ? `${ms / 1000}s` : `${ms}ms`;
}

export default runCommand;
