import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

export type CommandResult = { ok: true; stdout: string } | { ok: false; error: string };

export type CommandRunner = (
	command: string,
	args: string[],
	timeoutMs: number,
) => Promise<CommandResult>;

const OUTPUT_DRAIN_MS = 500;
const FORWARDED_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

const liveGroups = new Set<ChildProcess>();

/**
 * @description Starts a program as the leader of its own process group, so the program and every
 * process it forks can be killed together with {@link killGroup}. A group still running when this
 * process exits or is interrupted is killed with it.
 * @param command The program to run.
 * @param args Its arguments.
 * @param options The spawn options; `detached` is always set.
 * @returns The started child.
 */
export function spawnGroup(command: string, args: string[], options: SpawnOptions): ChildProcess {
	const child = spawn(command, args, { ...options, detached: true });

	if (child.pid === void 0) {
		return child;
	}

	if (!liveGroups.size) {
		watchParentExit();
	}

	liveGroups.add(child);
	child.once('exit', () => forgetGroup(child));
	child.once('error', () => forgetGroup(child));

	return child;
}

/**
 * @description Kills a child started with {@link spawnGroup} together with everything it forked.
 * @param child The group leader.
 * @param signal The signal to send.
 */
export function killGroup(child: ChildProcess, signal: NodeJS.Signals = 'SIGKILL'): void {
	if (child.pid === void 0) {
		return;
	}

	try {
		process.kill(-child.pid, signal);
	} catch {
		child.kill(signal);
	}
}

function forgetGroup(child: ChildProcess) {
	liveGroups.delete(child);

	if (!liveGroups.size) {
		unwatchParentExit();
	}
}

function killLiveGroups() {
	for (const child of liveGroups) {
		killGroup(child);
	}
}

function onParentSignal(signal: NodeJS.Signals) {
	killLiveGroups();
	unwatchParentExit();

	if (!process.listenerCount(signal)) {
		process.kill(process.pid, signal);
	}
}

function watchParentExit() {
	process.on('exit', killLiveGroups);

	for (const signal of FORWARDED_SIGNALS) {
		process.on(signal, onParentSignal);
	}
}

function unwatchParentExit() {
	process.off('exit', killLiveGroups);

	for (const signal of FORWARDED_SIGNALS) {
		process.off(signal, onParentSignal);
	}
}

/**
 * @description Runs a program to completion and captures its output, killing it and every process
 * it forked once the timeout elapses. A program that exits while a child it forked still holds its output open, as `adb` does
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
		const child = spawnGroup(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
			child.stdout?.destroy();
			child.stderr?.destroy();
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
			killGroup(child);
			settle({ ok: false, error: `${label} timed out after ${formatDuration(timeoutMs)}.` });
		}, timeoutMs);

		child.stdout?.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
		child.stderr?.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));

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
