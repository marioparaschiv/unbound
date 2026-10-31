import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { closeSync, openSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

import { bridgePortField } from '~/lib/context';
import { runCommand } from '~/lib/run-command';

const schema = z.object({
	action: z
		.enum(['restart', 'start'])
		.describe('Restart the running bridge, or start one when none runs.'),
	port: bridgePortField,
});

const LISTEN_TIMEOUT_MS = 15_000;
const LISTEN_POLL_MS = 250;
const LOOKUP_TIMEOUT_MS = 5_000;

const BRIDGE_ENTRY = join(import.meta.dir, '..', '..', '..', 'debugger', 'src', 'index.ts');

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

async function listenerPids(port: number): Promise<number[]> {
	const result = await runCommand(
		'lsof',
		['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
		LOOKUP_TIMEOUT_MS,
	);

	if (!result.ok) {
		return [];
	}

	return result.stdout
		.split('\n')
		.map((line) => Number(line.trim()))
		.filter((pid) => Number.isInteger(pid) && pid > 0);
}

/**
 * @description Names the log file a detached bridge writes to.
 * @param port The bridge's port.
 * @returns The path in the system temporary directory.
 */
function bridgeLogPath(port: number): string {
	return join(tmpdir(), `unbound-bridge-${port}.log`);
}

function startDetached(port: number): string {
	const log = bridgeLogPath(port);
	const output = openSync(log, 'a');
	const child = spawn('bun', [BRIDGE_ENTRY, '--port', String(port)], {
		detached: true,
		stdio: ['ignore', output, output],
	});

	child.unref();
	closeSync(output);

	return log;
}

const bridgeCommand: CommandDefinition<typeof schema> = {
	name: 'bridge',
	description:
		'Restart the debugger bridge so it runs the current code, or start one when none is listening. ' +
		'The bridge runs detached and writes its log to the system temporary directory.',
	surfaces: { cli: 'root', mcp: false },
	schema,
	cli: { positionals: ['action'] },
	async handler({ action, port }) {
		const running = await listenerPids(port);

		if (action === 'start' && running.length) {
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
	},
};

export default bridgeCommand;
