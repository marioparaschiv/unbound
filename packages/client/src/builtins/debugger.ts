import type {
	DeviceHello,
	PluginPushRequest,
	PluginPushResult,
	EvalResult,
	LogMessage,
} from '@unbound-app/debugger-protocol';
import { parseMessage } from '@unbound-app/debugger-protocol';
import type { PluginEntity } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';

import { CLIENT_VERSION, DEBUGGER_ADDRESS } from '~/lib/constants';
import { currentEnvironment } from '~/lib/environment';
import { createPatcher } from '~/api/patcher';
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

/** Connects to the debugger bridge and streams logs, evals and plugin pushes over it. */
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

/** Disconnects from the debugger bridge and removes every listener and patch. */
export function stop() {
	stopped = true;
	Patcher.unpatchAll();

	clearReconnectTimer();
	closeSocket();

	for (const dispose of disposers) dispose();

	disposers.clear();
}

/**
 * @description Whether the debugger is enabled in settings.
 * @returns `true` when `debugger.enabled` is set.
 */
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
		sayHello();
		Logger.success(isReconnect ? 'Reconnected' : 'Connected');
	});

	// Clear the socket and retry on both error and close: on failure RN may fire only one of them,
	// and leaving `ws` non-null would wedge the `if (ws) return` guard so no future attempt runs.
	ws.addEventListener('error', (event) => {
		Logger.error('Socket error:', ('message' in event ? event.message : null) ?? event);
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

// Read per attempt so an address edited in settings applies on the next reconnect. The build-time
// fallback tracks the dev host and is empty in production builds.
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

	if (ws.readyState === WebSocket.OPEN) {
		ws.close();
	}

	ws = null;
}

function handleMessage(raw: string) {
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
	} catch (error) {
		reply({ type: 'eval-result', id, ok: false, error: inspect(error) });
	}
}

// A thin transport caller: the reload lifecycle lives on the Plugins manager. Report the manager's
// own returned outcome straight back over the wire so the CLI stages the reload result.
async function handlePluginPush(request: PluginPushRequest) {
	try {
		const result = await plugins.reload(request.addonId, request.bundle, request.manifest);

		if (result.ok) {
			plugins.markDevelopmentCopy(request.addonId);
		}

		reply({
			type: 'plugin-push-result',
			id: request.id,
			ok: result.ok,
			error: result.ok ? void 0 : inspect(result.error),
		});
	} catch (error) {
		reply({ type: 'plugin-push-result', id: request.id, ok: false, error: inspect(error) });
	}
}

function sayHello() {
	const environment = currentEnvironment(CLIENT_VERSION);

	if (!environment || ws?.readyState !== WebSocket.OPEN) return;

	const hello: DeviceHello = {
		type: 'hello',
		device: {
			platform: environment.platform,
			discordVersion: environment.discordVersion,
			loaderVersion: environment.loaderVersion,
			clientVersion: environment.clientVersion,
		},
	};

	try {
		ws.send(JSON.stringify(hello));
	} catch {
		return;
	}
}

function reply(payload: EvalResult | PluginPushResult) {
	if (ws?.readyState !== WebSocket.OPEN) return;

	try {
		ws.send(JSON.stringify(payload));
	} catch {
		// Swallow: reporting the failure would route through the logging hook and could recurse.
	}
}

// UNKNOWN: summarises arbitrary eval results and thrown values.
function inspect(value: unknown): string {
	if (value instanceof Error) {
		return `${value.name}: ${value.message}\n${value.stack ?? ''}`.trim();
	}

	if (typeof value === 'string') {
		return value;
	}

	// Hermes can't stringify function sources, so summarise by name instead of `.toString()`.
	if (typeof value === 'function') {
		return value.name ? `[Function ${value.name}]` : '[Function]';
	}

	if (value === undefined) {
		return 'undefined';
	}

	if (typeof value === 'symbol' || typeof value === 'bigint') {
		return value.toString();
	}

	try {
		return JSON.stringify(value, null, 2);
	} catch {
		// Circular structures can't be serialised.
		return Object.prototype.toString.call(value);
	}
}

/**
 * @description Builds the bridge's log frame for one `nativeLoggingHook` call, whatever it was called with.
 * @param message The logged text, as the hook received it.
 * @param level The hook's level, as it received it.
 * @returns A frame the bridge accepts: string text and a level of 1, 2 or 3.
 */
// UNKNOWN: nativeLoggingHook is called by native code and other patches with whatever they pass.
export function logFrame(message: unknown, level: unknown): LogMessage {
	return {
		type: 'log',
		level: level === 2 || level === 3 ? level : 1,
		message: inspect(message),
	};
}

function patchLoggingHook() {
	Patcher.before(globalThis, 'nativeLoggingHook', ({ args }) => {
		const [message, level] = args;

		// Re-entrancy guard: `ws.send` failing (or any logging below) would route back through
		// `nativeLoggingHook` and recurse. Bail if we are already inside a send.
		if (ws?.readyState === WebSocket.OPEN && !sending) {
			sending = true;

			try {
				ws.send(JSON.stringify(logFrame(message, level)));
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

				if (ws?.readyState === WebSocket.OPEN) {
					ws.close();
				}

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

			if (payload.key !== 'debugger.address' || ws?.readyState !== WebSocket.OPEN) return;

			Logger.info('Address changed, reconnecting...');
			// The close handler clears `ws` and schedules the retry; dialling here would hit the
			// `if (ws) return` guard, since `close()` doesn't clear the socket synchronously.
			ws.close();
		},
	);
}

// Toast hot reloads on the device. This builtin only runs with the debugger enabled, so it is
// dev-gated by construction.
function listenToReloads() {
	function onReloaded(entity: PluginEntity) {
		showToast({
			id: `reload:${entity.id}`,
			title: 'Hot reload',
			content: `Reloaded ${entity.data.name}.`,
		});
	}

	function onReloadError(entity: PluginEntity, error: Error) {
		showToast({
			id: `reload:${entity.id}`,
			title: 'Hot reload failed',
			content: `${entity.data.name} failed to reload: ${error.message}`,
		});
	}

	plugins.on('reloaded', onReloaded);
	plugins.on('reload-error', onReloadError);

	return [
		() => void plugins.off('reloaded', onReloaded),
		() => void plugins.off('reload-error', onReloadError),
	];
}

export default { start, stop, shouldStart };
