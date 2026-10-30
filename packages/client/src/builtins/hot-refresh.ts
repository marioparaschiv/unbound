import { createLogger } from '@unbound-app/logger';

import { DEV, DEV_SERVER_URL } from '~/lib/constants';
import { performRefresh } from '~/lib/hot/runtime';
import { reload } from '~/api/native';

type DevRuntime = {
	applyPatch(code: string, changedIds: string[]): 'applied' | 'needs-reload';
};

type ServerMessage =
	| { type: 'patch'; code: string; filename: string; changedIds: string[] }
	| { type: 'reload' };

declare global {
	var __rolldown_runtime__: DevRuntime | undefined;
}

const Logger = createLogger('HotRefresh');

const RECONNECT_DELAY_MS = 2000;

let ws: WebSocket | null = null;
let stopped = true;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/** Connects to the dev server and applies each source change in place. */
export function start() {
	stopped = false;
	connect();
}

/** Disconnects from the dev server. */
export function stop() {
	stopped = true;

	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	ws?.close();
	ws = null;
}

/**
 * @description Whether this is a hot dev build, which bundles the dev runtime.
 * @returns `true` in dev builds made by the dev engine.
 */
export function shouldStart() {
	return DEV && Boolean(globalThis.__rolldown_runtime__);
}

function connect() {
	if (ws || stopped) return;

	const socket = new WebSocket(`${DEV_SERVER_URL.replace(/^http/, 'ws')}/__refresh`);

	socket.addEventListener('open', () => Logger.success('Connected'));
	socket.addEventListener('message', ({ data }) => {
		const message = parseServerMessage(data);

		if (message) {
			handle(socket, message);
		}
	});

	// RN may fire only one of error and close on a failed dial; a socket left in `ws` would block every retry.
	socket.addEventListener('error', () => {
		// An error on a socket that stays open leaves it working; only a failed dial needs a retry.
		if (socket.readyState !== WebSocket.OPEN) {
			scheduleReconnect(socket);
		}
	});
	socket.addEventListener('close', () => scheduleReconnect(socket));

	ws = socket;
}

function scheduleReconnect(socket: WebSocket) {
	if (ws === socket) {
		ws = null;
	}

	if (stopped || ws || reconnectTimer) return;

	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connect();
	}, RECONNECT_DELAY_MS);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isServerMessage(value: unknown): value is ServerMessage {
	if (typeof value !== 'object' || value === null || !('type' in value)) {
		return false;
	}

	if (value.type === 'reload') {
		return true;
	}

	return (
		value.type === 'patch' &&
		'code' in value &&
		typeof value.code === 'string' &&
		'filename' in value &&
		typeof value.filename === 'string' &&
		'changedIds' in value &&
		isStringArray(value.changedIds)
	);
}

// UNKNOWN: a WebSocket frame's data is whatever the dev server sent.
function parseServerMessage(data: unknown): ServerMessage | undefined {
	if (typeof data !== 'string') return;

	try {
		const value: unknown = JSON.parse(data);

		return isServerMessage(value) ? value : undefined;
	} catch {
		Logger.warn('Ignored a malformed message from the dev server.');

		return undefined;
	}
}

function handle(socket: WebSocket, message: ServerMessage) {
	if (message.type === 'reload') {
		reload();

		return;
	}

	const started = Date.now();

	try {
		const outcome = globalThis.__rolldown_runtime__?.applyPatch(
			message.code,
			message.changedIds,
		);

		if (outcome !== 'applied') {
			Logger.info(`${message.changedIds.join(', ')} can't be patched in place; reloading.`);
			rejectPatch(socket);

			return;
		}
	} catch (error) {
		Logger.error(`Failed to patch ${message.changedIds.join(', ')}; reloading:`, error);
		rejectPatch(socket);

		return;
	}

	socket.send(JSON.stringify({ type: 'applied', filename: message.filename }));

	const { count, needsRemount } = performRefresh();

	if (needsRemount) {
		Logger.info('A component changed its hooks; reloading.');
		rejectPatch(socket);

		return;
	}

	Logger.success(
		`Patched ${message.changedIds.join(', ')}: ${count} fibers in ${Date.now() - started}ms`,
	);
}

function rejectPatch(socket: WebSocket) {
	socket.send(JSON.stringify({ type: 'rejected' }));
}

export default { start, stop, shouldStart };
