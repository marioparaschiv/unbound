import type { PluginPushRequest } from '@unbound-app/debugger-protocol';
import { parseMessage } from '@unbound-app/debugger-protocol';
import type { PluginEntity } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';
import { createPatcher } from 'possess';

import { DEBUGGER_ADDRESS } from '~/lib/constants';
import { plugins } from '~/managers/plugins';
import { showToast } from '~/api/toasts';
import storage from '~/api/storage';

const Patcher = createPatcher('Debugger');
const Logger = createLogger('Debugger');
const Settings = storage.getStore('unbound');

// How long to wait before re-dialling the bridge after a drop or failed attempt, so a reloaded app
// or a restarted bridge reconnects on its own without waiting for the next AppState transition.
const RECONNECT_DELAY_MS = 2000;

let ws: WebSocket | null = null;
let sending = false;
let stopped = false;
let backgrounded = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const disposers = new Set<() => void>();

export function start() {
	stopped = false;

	patchLoggingHook();

	// start() is re-entered by the settings listener on toggle; the disposers already registered mean
	// the subscriptions below are live, and stacking a second set would fire every toast twice.
	if (!disposers.size) {
		disposers.add(listenToAppState());
		disposers.add(listenToSettings());
		for (const dispose of listenToReloads()) disposers.add(dispose);
	}

	// The socket only carries data reliably once the app is interactive, so connect on AppState
	// `active`. Attempt once now too, in case the app is already active and won't fire a transition.
	connect();
}

export function stop() {
	stopped = true;
	Patcher.unpatchAll();

	clearReconnectTimer();
	closeSocket();

	for (const dispose of disposers) dispose();
	disposers.clear();
}

export function shouldStart() {
	return Settings.get('debugger.enabled', false);
}

function connect(isReconnect = false) {
	// Already connected or a connection is in flight.
	if (ws || stopped) return;

	// A retry beat us to it; the pending attempt will run instead.
	clearReconnectTimer();

	const address = resolveAddress();

	if (!address) {
		Logger.error(
			'No debugger address configured; set `debugger.address` in developer settings.',
		);
		return;
	}

	ws = new WebSocket(`ws://${address}`);

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
		handleMessage(message.data);
	});
}

// Read per attempt rather than once at load, so an address edited in settings takes effect on the
// reconnect the change triggers. Falls back to the address baked in at build time, which tracks the
// dev host and is empty in production builds.
function resolveAddress() {
	return Settings.get('debugger.address', '') || DEBUGGER_ADDRESS;
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

function clearReconnectTimer() {
	if (!reconnectTimer) return;

	clearTimeout(reconnectTimer);
	reconnectTimer = null;
}

function closeSocket() {
	if (!ws) return;

	if (ws.readyState === WebSocket.OPEN) ws.close();
	ws = null;
}

function handleMessage(raw: any) {
	const request = parseMessage(raw);

	if (request?.type === 'eval') {
		void handleEvalRequest(request.id, request.code);
		return;
	}

	if (request?.type === 'plugin-push') {
		void handlePluginPush(request);
	}
}

async function handleEvalRequest(id: string, code: string) {
	try {
		// Await so `await`-style expressions resolve to their value, not a pending Promise.
		// oxlint-disable-next-line no-eval
		const value = await (0, eval)(code);
		reply({ type: 'eval-result', id, ok: true, value: inspect(value) });
	} catch (error: any) {
		reply({ type: 'eval-result', id, ok: false, error: inspect(error) });
	}
}

// A thin transport caller: the reload lifecycle lives on the Plugins manager. Report the manager's
// own returned outcome straight back over the wire so the CLI stages the reload result.
async function handlePluginPush(request: PluginPushRequest) {
	try {
		const result = await plugins.reload(request.addonId, request.bundle, request.manifest);

		reply({
			type: 'plugin-push-result',
			id: request.id,
			ok: result.ok,
			error: result.ok ? void 0 : inspect(result.error),
		});
	} catch (error: any) {
		reply({ type: 'plugin-push-result', id: request.id, ok: false, error: inspect(error) });
	}
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

function listenToAppState() {
	const { AppState } = globalThis.ReactNative;

	const subscription = AppState.addEventListener('change', (state: string) => {
		switch (state) {
			case 'active':
				backgrounded = false;
				connect(true);
				break;
			case 'background':
				backgrounded = true;
				clearReconnectTimer();
				if (ws?.readyState === WebSocket.OPEN) ws.close();
				break;
		}
	});

	return () => subscription.remove();
}

function listenToSettings() {
	return Settings.addListener(
		(payload) => Boolean(payload.key?.startsWith('debugger.')),
		(payload) => {
			if (payload.key === 'debugger.enabled') {
				if (payload.value) {
					start();
				} else {
					stop();
				}

				return;
			}

			if (payload.key === 'debugger.address' && ws?.readyState === WebSocket.OPEN) {
				Logger.info('Address changed, reconnecting...');
				// The close handler clears `ws` and schedules the retry; dialling here would hit the
				// `if (ws) return` guard, since `close()` doesn't clear the socket synchronously.
				ws.close();
			}
		},
	);
}

// Surface hot reloads on the device itself: the debugger builtin only runs when the debugger is
// enabled, so this is inherently dev-gated. A push-driven reload emits `reloaded`/`reload-error` on
// the plugins manager; turn each into a toast naming the plugin.
function listenToReloads() {
	const onReloaded = (entity: PluginEntity) => {
		showToast({
			id: `reload:${entity.id}`,
			title: 'Hot reload',
			content: `Reloaded ${entity.data.name}.`,
		});
	};

	const onReloadError = (entity: PluginEntity, error: Error) => {
		showToast({
			id: `reload:${entity.id}`,
			title: 'Hot reload failed',
			content: `${entity.data.name} failed to reload: ${error.message}`,
		});
	};

	plugins.on('reloaded', onReloaded);
	plugins.on('reload-error', onReloadError);

	return [
		() => void plugins.off('reloaded', onReloaded),
		() => void plugins.off('reload-error', onReloadError),
	];
}

export default { start, stop, shouldStart };
