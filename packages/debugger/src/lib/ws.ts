import { terminal } from 'terminal-kit';
import os from 'node:os';

import { abortCurrentReplInput, setupReplListeners, takeReplInput } from './repl';
import argv from './cli';


interface SocketMessage {
	level: 1 | 2 | 3;
	message: string;
}

export const state: {
	isInitialized: boolean,
	socket: Bun.ServerWebSocket | null;
} = {
	isInitialized: false,
	socket: null
};

export const MESSAGE_LEVELS = {
	1: terminal.gray,
	2: terminal.yellow,
	3: terminal.red
};

export function setupWebSocket() {
	if (state.isInitialized) return;

	Bun.serve({
		port: argv.flags.port,
		fetch(request, server) {
			if (state.socket) {
				return new Response(
					JSON.stringify({ error: 'Debugger is busy.' }),
					{ status: 503 }
				);
			}

			server.upgrade(request);
		},
		websocket: {
			open(ws) {
				state.socket = ws;
				terminal.bold.green('Client connected.\n');

				setupReplListeners();
				takeReplInput();
			},
			message(_, message: string) {
				try {
					const payload: SocketMessage = JSON.parse(message);
					abortCurrentReplInput(true);

					MESSAGE_LEVELS[payload.level](`« ${payload.message}\n`);

					takeReplInput();
				} catch (error) {
					terminal.red(`Parsing failed on message from client.\n`);
				}
			},
			close() {
				state.socket = null;
				abortCurrentReplInput(true);
				terminal.red('Client disconnected.\n');
			}
		}
	});

	const localAddress = getLocalAddress();

	terminal.gray(`Unbound's Debugger is now active. Connect using ${localAddress}:${argv.flags.port}\n`);
}

export function getLocalAddress() {
	const interfaces = os.networkInterfaces();

	for (const ifaces of Object.values(interfaces)) {
		if (!ifaces) continue;

		for (const iface of ifaces) {
			// Skip over internal (i.e., 127.0.0.1) and non-IPv4 addresses
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}
};


export function send(...payload: Parameters<Bun.ServerWebSocket['send']>) {
	if (!state.socket) {
		return terminal.bold.red('You cannot send messages without a connected client.\n');
	}

	state.socket.send(...payload);
}