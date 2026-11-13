import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { SERVE_BRIDGE_COMMAND } from '@unbound-app/debugger-protocol';
import { closeSync, openSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runCommand } from '~/lib/run-command';

const LISTEN_TIMEOUT_MS = 15_000;
// Polls a local port, so short: a spawned bridge listens within a few hundred milliseconds.
const LISTEN_POLL_MS = 20;
const LOOKUP_TIMEOUT_MS = 5_000;

function isListening(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ host: '127.0.0.1', port });

		socket.once('connect', () => {
			socket.destroy();
			resolve(true);
		});
		socket.once('error', () => resolve(false));
	});
}

async function waitUntil(port: number, listening: boolean): Promise<boolean> {
	const deadline = Date.now() + LISTEN_TIMEOUT_MS;

	while (Date.now() < deadline) {
		if ((await isListening(port)) === listening) {
			return true;
		}

		await Bun.sleep(LISTEN_POLL_MS);
	}

	return false;
}

async function listenerPids(port: number): Promise<number[] | { error: string }> {
	if (!(await isListening(port))) {
		return [];
	}

	const result = await runCommand(
		'lsof',
		['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
		LOOKUP_TIMEOUT_MS,
	);

	if (!result.ok) {
		return {
			error: `Something listens on port ${port}, but finding its process failed: ${result.error}`,
		};
	}

	return result.stdout
		.split('\n')
		.map((line) => Number(line.trim()))
		.filter((pid) => Number.isInteger(pid) && pid > 0);
}

function bridgeLogPath(port: number): string {
	return join(tmpdir(), `unbound-bridge-${port}.log`);
}

function startDetached(port: number): string {
	const log = bridgeLogPath(port);
	const output = openSync(log, 'a');
	// A compiled `ubd` carries the bridge and runs it as itself. Otherwise Bun runs the debugger's
	// entry: its source in the workspace and its build once published.
	const [command, args] = Bun.isStandaloneExecutable
		? [process.execPath, [SERVE_BRIDGE_COMMAND]]
		: ['bun', [Bun.resolveSync('@unbound-app/debugger', import.meta.dir)]];
	const child = spawn(command, [...args, '--port', String(port)], {
		detached: true,
		stdio: ['ignore', output, output],
	});

	child.unref();
	closeSync(output);

	return log;
}

/**
 * @description Starts the debugger bridge in the background when none listens, and waits until one
 * does. Two tools starting it at once are safe: the second bridge cannot take the port and exits.
 * @param port The port the bridge listens on.
 * @returns Whether a bridge listens now.
 */
export async function ensureBridge(port: number): Promise<boolean> {
	if (await isListening(port)) {
		return true;
	}

	startDetached(port);

	return waitUntil(port, true);
}

/**
 * @description Starts the debugger bridge detached, logging to the system temporary directory. With
 * `restart`, stops the bridge already listening first, so it runs the current code.
 * @param port The port the bridge listens on.
 * @param restart Whether to replace a running bridge instead of keeping it.
 * @returns Whether a bridge listens now, and where its log is.
 */
export async function launchBridge(port: number, restart: boolean): Promise<CommandOutput> {
	const running = await listenerPids(port);

	if ('error' in running) {
		return { ok: false, text: running.error };
	}

	if (!restart && running.length) {
		return { ok: true, text: `A bridge already listens on port ${port}.` };
	}

	for (const pid of running) {
		try {
			process.kill(pid);
		} catch {
			continue;
		}
	}

	if (running.length && !(await waitUntil(port, false))) {
		return { ok: false, text: `The bridge on port ${port} did not stop.` };
	}

	const log = startDetached(port);

	if (!(await waitUntil(port, true))) {
		return {
			ok: false,
			text: `The bridge did not start listening on port ${port}; see ${log}.`,
		};
	}

	const verb = running.length ? 'Restarted' : 'Started';

	return { ok: true, text: `${verb} the bridge on port ${port}. Its log is ${log}.` };
}

export default launchBridge;
