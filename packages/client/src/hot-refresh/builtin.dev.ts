import { createLogger } from '@unbound-app/logger';

import type { DeviceMessage, DevRuntime, PatchMessage } from '~/hot-refresh/messages';
import { performRefresh } from '~/hot-refresh/runtime';
import { DEV_SERVER_URL } from '~/core/constants';

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
	return import.meta.env.DEV && Boolean(globalThis.__rolldown_runtime__);
}

function connect() {
	if (ws || stopped) return;

	const socket = new WebSocket(`${DEV_SERVER_URL.replace(/^http/, 'ws')}/__refresh`);

	socket.addEventListener('open', () => Logger.success('Connected'));
	socket.addEventListener('message', ({ data }) => {
		const message = parsePatchMessage(data);

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

// Patches only: a change no patch covers is reloaded by the loader's `/__hot` stream, which outlives a JS reload.
function isPatchMessage(value: unknown): value is PatchMessage {
	if (typeof value !== 'object' || value === null || !('type' in value)) {
		return false;
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
function parsePatchMessage(data: unknown): PatchMessage | undefined {
	if (typeof data !== 'string') return;

	try {
		const value: unknown = JSON.parse(data);

		return isPatchMessage(value) ? value : undefined;
	} catch {
		Logger.warn('Ignored a malformed message from the dev server.');

		return undefined;
	}
}

function handle(socket: WebSocket, message: PatchMessage) {
	const started = Date.now();

	try {
		const outcome = globalThis.__rolldown_runtime__?.applyPatch(
			message.code,
			message.changedIds,
		);

		if (outcome !== 'applied') {
			Logger.info(`${message.changedIds.join(', ')} can't be patched in place; reloading.`);
			rejectPatch(socket, `${message.changedIds.join(', ')} can't be patched in place`);

			return;
		}
	} catch (error) {
		Logger.error(`Failed to patch ${message.changedIds.join(', ')}; reloading:`, error);
		rejectPatch(socket, `Failed to patch ${message.changedIds.join(', ')}: ${String(error)}`);

		return;
	}

	send(socket, { type: 'applied', filename: message.filename });

	const { count, remounted } = performRefresh();
	const ms = Date.now() - started;

	send(socket, { type: 'refreshed', fibers: count, remounted, ms });
	Logger.success(
		`Patched ${message.changedIds.join(', ')}: ${count} fibers (${remounted} remounted) in ${ms}ms`,
	);
}

function rejectPatch(socket: WebSocket, reason: string) {
	send(socket, { type: 'rejected', reason });
}

function send(socket: WebSocket, message: DeviceMessage) {
	socket.send(JSON.stringify(message));
}

export default { start, stop, shouldStart };
