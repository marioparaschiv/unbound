// TODO: Rewrite this dogshit

import { parseMessage } from '@unbound-app/debugger-protocol';
import { createLogger } from '@unbound-app/logger';
import { createPatcher } from 'possess';

import storage, { type SettingsPayload } from '~/api/storage';

// TEMP: forced on with a hardcoded address until the settings UI is ported. Edit this to point the
// debugger at your machine.
const DEBUGGER_ADDRESS = '192.168.64.1:9090';

const Patcher = createPatcher('Debugger');
const Logger = createLogger('Debugger');

// How long to wait before re-dialling the bridge after a drop or failed attempt, so a reloaded app
// or a restarted bridge reconnects on its own without waiting for the next AppState transition.
const RECONNECT_DELAY_MS = 2000;

let ws: WebSocket | null = null;
let sending = false;
let stopped = false;
let backgrounded = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: { remove: () => void } | null = null;

const listeners = new Set<(payload: any) => void>();

export function start() {
	stopped = false;

	patchLoggingHook();
	attachAppStateListener();
	attachSettingsListener();

	// The socket only carries data reliably once the app is interactive, so connect on AppState
	// `active`. Attempt once now too, in case the app is already active and won't fire a transition.
	connect();
}

function connect(isReconnect = false) {
	// Already connected or a connection is in flight.
	if (ws || stopped) return;

	// A retry beat us to it; the pending attempt will run instead.
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	ws = new WebSocket(`ws://${DEBUGGER_ADDRESS}`);

	ws.addEventListener('open', () => {
		Logger.success(isReconnect ? 'Reconnected' : 'Connected');
	});

	// Clear the socket and retry on both error and close: on failure RN may fire only one of them,
	// and leaving `ws` non-null would wedge the `if (ws) return` guard so no future attempt runs.
	ws.addEventListener('error', (event: any) => {
		Logger.error('Socket error:', event?.message ?? event);
		ws = null;
		scheduleReconnect();
	});

	ws.addEventListener('close', ({ code }) => {
		Logger.warn(`Socket closed with code ${code}`);
		ws = null;
		scheduleReconnect();
	});

	ws.addEventListener('message', (message) => {
		handleEvalRequest(message.data);
	});
}

function scheduleReconnect() {
	// Don't retry after an explicit stop, while backgrounded, while a socket is live, or if one is
	// already scheduled. Coming back to `active` re-drives the connection.
	if (stopped || backgrounded || ws || reconnectTimer) return;

	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connect(true);
	}, RECONNECT_DELAY_MS);
}

function handleEvalRequest(raw: any) {
	const request = parseMessage(raw);

	if (request?.type !== 'eval') return;

	// Await thenables so `await`-style expressions resolve to their value, not a pending Promise.
	Promise.resolve()
		.then(() => {
			// oxlint-disable-next-line no-eval
			return (0, eval)(request.code);
		})
		.then(
			(value) =>
				reply({ type: 'eval-result', id: request.id, ok: true, value: inspect(value) }),
			(error) =>
				reply({ type: 'eval-result', id: request.id, ok: false, error: inspect(error) }),
		);
}

function reply(payload: object) {
	if (ws?.readyState !== WebSocket.OPEN) return;

	try {
		ws.send(JSON.stringify(payload));
	} catch {
		// Swallow: reporting the failure would route through the logging hook and could recurse.
	}
}

function inspect(value: any): string {
	if (value instanceof Error)
		return `${value.name}: ${value.message}\n${value.stack ?? ''}`.trim();
	if (typeof value === 'string') return value;
	// Hermes can't stringify function sources, so summarise by name instead of `.toString()`.
	if (typeof value === 'function') return value.name ? `[Function ${value.name}]` : '[Function]';
	if (value === undefined) return 'undefined';

	try {
		return JSON.stringify(value, null, 2) ?? String(value);
	} catch {
		return String(value);
	}
}

export function stop() {
	stopped = true;
	Patcher.unpatchAll();

	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	if (ws) {
		if (ws.readyState === WebSocket.OPEN) ws.close();
		ws = null;
	}

	if (appStateSubscription) {
		appStateSubscription.remove();
		appStateSubscription = null;
	}

	for (const listener of listeners) {
		storage.removeListener(listener);
	}

	listeners.clear();
}

export function shouldStart() {
	// TEMP: forced on until the settings UI is ported. Was: Settings.get('debugger.enabled', false).
	return true;
}

function patchLoggingHook() {
	Patcher.before(globalThis, 'nativeLoggingHook', ({ args }) => {
		const [message, level] = args;

		// Re-entrancy guard: `ws.send` failing (or any logging below) would route back through
		// `nativeLoggingHook` and recurse. Bail if we are already inside a send.
		if (ws?.readyState === WebSocket.OPEN && !sending) {
			sending = true;
			try {
				ws.send(JSON.stringify({ type: 'log', level, message }));
			} catch {
				// Swallow: logging the failure here would re-enter this hook and loop.
			} finally {
				sending = false;
			}
		}

		return args;
	});
}

function attachAppStateListener() {
	const { AppState } = globalThis.ReactNative;

	appStateSubscription = AppState.addEventListener('change', (state: string) => {
		switch (state) {
			case 'active':
				backgrounded = false;
				connect(true);
				break;
			case 'background':
				backgrounded = true;
				if (reconnectTimer) {
					clearTimeout(reconnectTimer);
					reconnectTimer = null;
				}
				if (ws?.readyState === WebSocket.OPEN) ws.close();
				break;
		}
	});
}

function attachSettingsListener() {
	const handler = (payload: SettingsPayload) => {
		if (!payload.key?.startsWith('debugger.')) return;

		if (payload.key === 'debugger.enabled') {
			if (payload.value) {
				start();
			} else {
				stop();
			}
		} else if (payload.key === 'debugger.address') {
			if (ws?.readyState === WebSocket.OPEN) {
				Logger.info('Address changed, reconnecting...');
				ws.close();
				connect(true);
			}
		}
	};

	storage.on('changed', handler);
	listeners.add(handler);
}

export default { start, stop, shouldStart };
