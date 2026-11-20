import {
	CONTROLLER_ENDPOINT_MARKER,
	isExplorerRequest,
	isMetroRequest,
	parseMessage,
} from '@unbound-app/debugger-protocol';
import { terminal } from 'terminal-kit';
import os from 'node:os';

import {
	abortCurrentReplInput,
	setupReplListeners,
	state as replState,
	takeReplInput,
} from './repl';
import { describeDevice, printLog, system, timestamp } from './output';
import { createIdleExit } from './idle-exit';
import { printBanner } from './banner';
import * as session from './session';
import argv from './cli';

export const state: {
	isInitialized: boolean;
} = {
	isInitialized: false,
};

/**
 * Marks a socket's role so the WebSocket handlers can route it. Set at upgrade time from the URL: a
 * controller connects with `?mcp`, everything else is the device (the on-device debugger dialling in).
 */
type SocketData = {
	role: 'device' | 'controller';
};

/**
 * @description Boots the bridge: the phone-facing WebSocket server, the shared session routing, and
 * the terminal REPL as an in-process controller. A device connects plainly; controllers (MCP
 * clients) connect with `?mcp` and share the single device socket.
 * @returns Whether this process now hosts the bridge; `false` when another process holds the port.
 */
export function setupWebSocket(): boolean {
	if (state.isInitialized) {
		return true;
	}

	try {
		serve();
	} catch {
		// Bun throws when the port is taken: another bridge owns it, so the caller attaches instead.
		return false;
	}

	state.isInitialized = true;
	replState.evaluate = session.evaluate;

	listenToSession();

	const localAddress = getLocalAddress();

	printBanner(
		`${localAddress}:${argv.flags.port}`,
		`ws://127.0.0.1:${argv.flags.port}?${CONTROLLER_ENDPOINT_MARKER}`,
	);

	return true;
}

function serve() {
	Bun.serve<SocketData>({
		// IPv4 only, like the DevTools bridge: on macOS a dual-stack `::` listener can share the port with
		// another bridge's `0.0.0.0` one, splitting the device and the controllers across two bridges.
		hostname: '0.0.0.0',
		port: argv.flags.port,
		fetch(request, server) {
			const url = new URL(request.url);

			// Controllers (the MCP server, and any future tooling) attach with `?mcp`. Any number may
			// share the one device, so they're never rejected for being "busy".
			if (url.searchParams.has(CONTROLLER_ENDPOINT_MARKER)) {
				server.upgrade(request, { data: { role: 'controller' } });

				return;
			}

			server.upgrade(request, { data: { role: 'device' } });
		},
		websocket: {
			open(ws) {
				if (ws.data.role === 'controller') {
					session.attachController(ws);

					return;
				}

				session.attachDevice(ws);
				// Clear any prompt a prior banner left drawn, so it doesn't sit in front of this line.
				abortCurrentReplInput({ deletePrompt: true });
				system('green', 'Device connected');

				setupReplListeners();
				takeReplInput();
			},
			message(ws, message) {
				if (typeof message !== 'string') return;

				if (ws.data.role === 'controller') {
					handleControllerMessage(ws, message);

					return;
				}

				if (ws === session.state.device) {
					handleDeviceMessage(message);
				}
			},
			close(ws) {
				if (ws.data.role === 'controller') {
					session.detachController(ws);

					return;
				}

				session.detachDevice(ws);
				abortCurrentReplInput({ deletePrompt: true, deleteCurrentInput: true });
				system('red', 'Device disconnected');
			},
		},
	});
}

function listenToSession() {
	// The REPL is a local controller: the device's log stream surfaces in the terminal without going
	// back out over a socket.
	session.onLog((log) => {
		// Erase the drawn prompt so its leftover marker doesn't stack in front of the log.
		abortCurrentReplInput({ deletePrompt: true });
		printLog(log);
		takeReplInput();
	});

	// Mirror MCP activity into the terminal for a full transcript. Only the eval input is tagged
	// `[mcp]`: results come from the device and logs are ambient, so neither is MCP-originated.
	session.onControllerEval((code) => {
		abortCurrentReplInput({ deletePrompt: true });
		terminal.magenta(`${timestamp()} » [mcp] ${code}\n`);
		takeReplInput();
	});

	session.onControllerResult((result) => {
		abortCurrentReplInput({ deletePrompt: true });

		if (result.ok) {
			terminal.gray(`${timestamp()} « ${result.value}\n`);
		} else {
			terminal.red(`${timestamp()} « ${result.error}\n`);
		}

		takeReplInput();
	});

	session.onDevice((connected, device) => {
		if (!connected || !device) return;

		abortCurrentReplInput({ deletePrompt: true });
		system('green', `Device identified: ${describeDevice(device)}`);
		takeReplInput();
	});

	// Announce MCP (controller) connects/disconnects with a fancy pink banner, showing how many are
	// now attached so it's clear when several tools share the one device.
	session.onController((connected, count) => {
		abortCurrentReplInput({ deletePrompt: true });

		const plural = count === 1 ? 'client' : 'clients';
		const label = connected
			? `MCP connected - ${count} ${plural} attached`
			: `MCP disconnected - ${count} ${plural} attached`;

		system('pink', label);
		takeReplInput();
	});

	// A bridge spawned in the background exits once every controller has left, so closing the last
	// tool leaves nothing running. A terminal REPL is a controller of its own, so it never idles.
	if (argv.flags.idleTimeout <= 0 || process.stdin.isTTY) return;

	const onControllerCount = createIdleExit(argv.flags.idleTimeout * 1000, () => {
		system('gray', `No controller for ${argv.flags.idleTimeout}s, exiting`);
		process.exit(0);
	});

	session.onController((_connected, count) => onControllerCount(count));
}

function handleDeviceMessage(raw: string) {
	const message = parseMessage(raw);

	if (!message) {
		system(
			'red',
			`Parsing failed on message from device: ${JSON.stringify(raw.slice(0, 200))}`,
		);

		return;
	}

	session.handleDeviceMessage(message);
}

function handleControllerMessage(ws: session.SocketLike, raw: string) {
	const message = parseMessage(raw);

	// Requests are answered by id over this same controller's socket; a view-highlight or React DevTools frame has no answer.
	if (message?.type === 'eval') {
		session.evaluateForController(ws, message);

		return;
	}

	if (message?.type === 'plugin-push') {
		session.pushForController(ws, message);

		return;
	}

	if (message?.type === 'views-request') {
		session.requestViewsForController(ws, message);

		return;
	}

	if (message?.type === 'view-details-request') {
		session.requestViewDetailsForController(ws, message);

		return;
	}

	if (message && isExplorerRequest(message)) {
		session.requestExplorerForController(ws, message);

		return;
	}

	if (message && isMetroRequest(message)) {
		session.requestMetroForController(ws, message);

		return;
	}

	if (message?.type === 'view-highlight') {
		session.highlightView(message);

		return;
	}

	if (message?.type === 'react-devtools') {
		session.relayReactDevtools(ws, message);
	}
}

/**
 * @description Finds the machine's first external IPv4 address, for devices on the LAN to dial.
 * @returns The address, or `undefined` if the machine has none.
 */
function getLocalAddress(): string | undefined {
	const interfaces = os.networkInterfaces();

	for (const ifaces of Object.values(interfaces)) {
		if (!ifaces) {
			continue;
		}

		for (const iface of ifaces) {
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}
}
