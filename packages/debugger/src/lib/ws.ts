import { terminal, stripEscapeSequences } from 'terminal-kit';
import { parseMessage } from '@unbound-app/debugger-protocol';
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

export const MESSAGE_LEVELS = {
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
 * @description Prints a bold, glyph-prefixed banner line for a bridge lifecycle event, tinted with
 * the given hex colour. Uses terminal-kit's runtime `colorRgbHex`, which `@types/terminal-kit`
 * doesn't declare, so the chain is reached through a narrow cast.
 * @param color The banner colour, keyed into {@link SYSTEM_COLORS}.
 * @param text The line to print (the glyph is prepended and a trailing newline added).
 */
function system(color: keyof typeof SYSTEM_COLORS, text: string) {
	(terminal.bold as unknown as { colorRgbHex: (hex: string, str: string) => void }).colorRgbHex(
		SYSTEM_COLORS[color],
		`${SYSTEM_GLYPH} ${text}\n`,
	);
}

/**
 * Marks a socket's role so the WebSocket handlers can route it. Set at upgrade time from the URL: a
 * controller connects with `?mcp`, everything else is the device (the on-device debugger dialling in).
 */
interface SocketData {
	role: 'device' | 'controller';
}

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

			// The device is single: a second one would make eval routing ambiguous.
			if (session.state.device) {
				return new Response(JSON.stringify({ error: 'A device is already connected.' }), {
					status: 503,
				});
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

				handleDeviceMessage(message);
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
		MESSAGE_LEVELS[log.level](`« ${formatLog(stripEscapeSequences(log.message))}\n`);
		takeReplInput();
	});

	// Mirror MCP (controller) activity into the terminal so it's a full transcript: the code an MCP
	// asked to run, and the value/error it got back, interleaved with the device's console logs above.
	// Only the eval input is tagged `[mcp]` — it genuinely originates from the MCP; the result is just
	// a value from the device, and logs are ambient (any part of the app can emit them in the same
	// window), so neither is labelled as MCP-originated.
	session.onControllerEval((code) => {
		abortCurrentReplInput({ deletePrompt: true });
		terminal.magenta(`» [mcp] ${code}\n`);
		takeReplInput();
	});

	session.onControllerResult((result) => {
		abortCurrentReplInput({ deletePrompt: true });
		if (result.ok) {
			terminal.gray(`« ${result.value}\n`);
		} else {
			terminal.red(`« ${result.error}\n`);
		}
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
		system('red', 'Parsing failed on message from device');
		return;
	}

	session.handleDeviceMessage(message);
}

function handleControllerMessage(ws: session.SocketLike, raw: string) {
	const message = parseMessage(raw);

	// The only thing a controller sends is an eval request; run it and deliver the id-correlated
	// result back over this same controller's socket.
	if (message?.type !== 'eval') return;

	session.evaluateForController(ws, message.id, message.code);
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
}
