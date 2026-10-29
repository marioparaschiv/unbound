import { parseMessage, type DeviceInfo } from '@unbound-app/debugger-protocol';
import { terminal, stripEscapeSequences } from 'terminal-kit';
import os from 'node:os';

import { abortCurrentReplInput, setupReplListeners, takeReplInput } from './repl';
import { formatLog } from './format-log';
import { printBanner } from './banner';
import * as session from './session';
import argv from './cli';

export const state: {
	isInitialized: boolean;
} = {
	isInitialized: false,
};

const MESSAGE_LEVELS = {
	1: terminal.gray,
	2: terminal.yellow,
	3: terminal.red,
} as const;

/** The glyph that prefixes every bridge lifecycle line, so system events read as one family. */
const SYSTEM_GLYPH = '✦';

/** Hex colours for the system banners: pink for MCP, green/red for the device, gray for startup. */
const SYSTEM_COLORS = {
	pink: '#ff5fbf',
	green: '#3cb371',
	red: '#ff6b6b',
	gray: '#9ca3af',
} as const;

/**
 * @description Prints a bold, glyph-prefixed banner line for a bridge lifecycle event.
 * @param color The banner colour, keyed into {@link SYSTEM_COLORS}.
 * @param text The line to print (the glyph is prepended and a trailing newline added).
 */
function system(color: keyof typeof SYSTEM_COLORS, text: string) {
	terminal.bold.colorRgbHex(SYSTEM_COLORS[color], `${timestamp()} ${SYSTEM_GLYPH} ${text}\n`);
}

/**
 * @description Formats the current local time for the start of a bridge log line.
 * @param now The moment to format.
 * @returns The time as `HH:MM:SS.mmm`.
 */
export function timestamp(now = new Date()): string {
	const pad = (value: number, width = 2) => String(value).padStart(width, '0');

	return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

/**
 * @description Describes a device from its hello for the bridge log.
 * @param device What the device reported.
 * @returns A one-line summary such as `ios, Discord 351.0, loader 1.0.0, client 0.9.0`.
 */
export function describeDevice(device: DeviceInfo): string {
	return `${device.platform}, Discord ${device.discordVersion}, loader ${device.loaderVersion}, client ${device.clientVersion}`;
}

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
 */
export function setupWebSocket() {
	if (state.isInitialized) return;

	state.isInitialized = true;

	Bun.serve<SocketData>({
		port: argv.flags.port,
		fetch(request, server) {
			const url = new URL(request.url);

			// Controllers (the MCP server, and any future tooling) attach with `?mcp`. Any number may
			// share the one device, so they're never rejected for being "busy".
			if (url.searchParams.has('mcp')) {
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

	// The REPL is a local controller: the device's log stream surfaces in the terminal without going
	// back out over a socket.
	session.onLog((log) => {
		// Erase the drawn prompt so its leftover marker doesn't stack in front of the log.
		abortCurrentReplInput({ deletePrompt: true });
		// The client colours its own log lines, so strip the embedded ANSI — the level colour below is
		// the terminal's, and the raw escapes would otherwise render as literal `[...` noise.
		MESSAGE_LEVELS[log.level](
			`${timestamp()} « ${formatLog(stripEscapeSequences(log.message))}\n`,
		);
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

	const localAddress = getLocalAddress();

	printBanner(`${localAddress}:${argv.flags.port}`, `ws://127.0.0.1:${argv.flags.port}?mcp`);
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

	// A controller sends either an eval request or a plugin-push; run it and deliver the id-correlated
	// result back over this same controller's socket.
	if (message?.type === 'eval') {
		session.evaluateForController(ws, message);

		return;
	}

	if (message?.type === 'plugin-push') {
		session.pushPluginForController(ws, message);
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
			// Skip over internal (i.e., 127.0.0.1) and non-IPv4 addresses
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}
}
