import type {
	DeviceHello,
	PushRequest,
	PushResult,
	EvalResult,
	ExplorerRequest,
	ExplorerResult,
	LogMessage,
	MetroResult,
	ReactDevtoolsFrame,
	ViewDetailsRequest,
	ViewDetailsResult,
	ViewsRequest,
	ViewsResult,
} from '@unbound-app/debugger-protocol';
import { isExplorerRequest, isMetroRequest, parseMessage } from '@unbound-app/debugger-protocol';
import { createLogger } from '@unbound-app/logger';

import {
	describeView,
	highlightView,
	listViews,
	resetViewFinder,
} from '~/debugger/view-finder.dev';
import { isTrusted, promptToConnect } from '~/debugger/discovery-prompt.dev';
import { answerExplorer, resetExplorer } from '~/debugger/explorer.dev';
import type { DiscoveredBridge } from '~/debugger/bridge-service.dev';
import { CLIENT_VERSION, DEBUGGER_ADDRESS } from '~/core/constants';
import { endSession, receive } from '~/debugger/react-devtools.dev';
import { getSetting, isSettingChange } from '~/settings/unbound';
import { readDebugReport } from '~/diagnostics/read-debug-info';
import { answerMetro, resetMetro } from '~/debugger/metro.dev';
import { reloadSummary } from '~/debugger/reload-summary.dev';
import { browseBridges } from '~/debugger/discovery.dev';
import { createPatcher } from '~/patcher/create-patcher';
import { currentEnvironment } from '~/core/environment';
import { getLoader } from '~/native/unbound-native';
import type { DialogHandle } from '~/dialogs/api';
import type { Addon } from '~/addons/addon';
import { plugins } from '~/plugins/manager';
import { themes } from '~/themes/manager';
import { onChange } from '~/storage/api';
import { show } from '~/toasts/api';

const Patcher = createPatcher('Debugger');
const Logger = createLogger('Debugger');

// Re-dials after a drop or failed attempt, so a reloaded app or restarted bridge reconnects without an AppState change.
// Short, since tools start the bridge on demand and wait for the device to dial it.
const RECONNECT_DELAY_MS = 500;
const RELOAD_BATCH_MS = 4000;

let ws: WebSocket | null = null;
let sending = false;
let stopped = false;
let backgrounded = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
// Dials that failed since the last open; only the first of a run is logged, so retries stay quiet.
let failedDials = 0;
// The address of the bridge the user chose from the network, dialled before the build-time fallback.
let discovered: string | undefined;
let stopBrowsing: (() => void) | undefined;
let prompt: { computer: string; handle: DialogHandle } | undefined;
// Bridges the user said "Not now" to this run, by computer and pairing code, so a restarted bridge asks again.
const declined = new Set<string>();

const disposers = new Set<() => void>();

const DEBUG_REPORT_GLOBAL = '__UNBOUND_DEBUG_REPORT__';

/** Connects to the debugger bridge and streams logs, evals and pushes over it. */
export function start() {
	stopped = false;
	Reflect.set(globalThis, DEBUG_REPORT_GLOBAL, readDebugReport);

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
	Reflect.deleteProperty(globalThis, DEBUG_REPORT_GLOBAL);
	Patcher.unpatchAll();

	clearReconnectTimer();
	closeSocket();
	stopDiscovery();
	resetViewFinder();
	resetExplorer();
	resetMetro();
	endSession();

	for (const dispose of disposers) dispose();

	disposers.clear();
}

/**
 * @description Whether the debugger is enabled in settings.
 * @returns `true` when `debugger.enabled` is set.
 */
export function shouldStart() {
	return getSetting('debugger.enabled');
}

function connect(isReconnect = false) {
	// Already connected or a connection is in flight.
	if (ws || stopped) return;

	// A retry beat us to it; the pending attempt will run instead.
	clearReconnectTimer();

	const address = resolveAddress();

	if (!address) {
		// Nothing to dial until a bridge shows up on the network.
		startDiscovery();

		return;
	}

	const socket = new WebSocket(`ws://${address}`);

	ws = socket;

	let opened = false;

	socket.addEventListener('open', () => {
		opened = true;
		failedDials = 0;
		stopDiscovery();
		sayHello();
		Logger.success(isReconnect ? 'Reconnected' : 'Connected');
	});

	// Clear the socket and retry on both error and close: on failure RN may fire only one of them,
	// and leaving `ws` non-null would wedge the `if (ws) return` guard so no future attempt runs.

	// A socket dropped for a discovered bridge is no longer `ws`, so its events clear nothing.
	socket.addEventListener('error', (event) => {
		if (ws !== socket) return;

		if (!failedDials) {
			Logger.error('Socket error:', ('message' in event ? event.message : null) ?? event);
		}

		if (!opened) {
			failedDials++;
		}

		ws = null;
		startDiscovery();
		scheduleReconnect();
	});

	socket.addEventListener('close', ({ code }) => {
		if (ws !== socket) return;

		if (!failedDials) {
			Logger.warn(`Socket closed with code ${code}`);
		}

		if (!opened) {
			failedDials++;
		}

		ws = null;
		// The frontend starts a fresh session once the socket is back, and explorer refs end with the session.
		endSession();
		resetExplorer();
		resetMetro();
		startDiscovery();
		scheduleReconnect();
	});

	socket.addEventListener('message', (message) => {
		handleMessage(message.data);
	});
}

// Read per attempt so an edited address applies on the next reconnect. Then the bridge the user chose
// from the network; the build-time fallback tracks the dev host and is empty in production builds.
function resolveAddress() {
	return getSetting('debugger.address') || discovered || DEBUGGER_ADDRESS;
}

// Browses only while disconnected with no address set by hand, so a found bridge can be offered.
function startDiscovery() {
	if (stopped || backgrounded || stopBrowsing || getSetting('debugger.address')) return;

	stopBrowsing = browseBridges({ found: onBridgeFound, lost: onBridgeLost });
}

function stopDiscovery() {
	stopBrowsing?.();
	stopBrowsing = undefined;
	prompt?.handle.dismiss();
	prompt = undefined;
}

function onBridgeFound(bridge: DiscoveredBridge) {
	const key = `${bridge.computer}:${bridge.code}`;

	if (ws?.readyState === WebSocket.OPEN || declined.has(key) || prompt) return;

	if (isTrusted(bridge)) {
		dialDiscovered(bridge);

		return;
	}

	const handle = promptToConnect(
		bridge,
		() => {
			prompt = undefined;
			dialDiscovered(bridge);
		},
		() => {
			prompt = undefined;
			declined.add(key);
		},
	);

	prompt = { computer: bridge.computer, handle };
}

function onBridgeLost(computer: string) {
	if (prompt?.computer !== computer) return;

	prompt.handle.dismiss();
	prompt = undefined;
}

function dialDiscovered(bridge: DiscoveredBridge) {
	Logger.info(`Connecting to the bridge on ${bridge.computer} at ${bridge.address}`);
	discovered = bridge.address;

	// Drop the dial in flight to the fallback address; its handlers see it is no longer `ws`.
	if (ws?.readyState !== WebSocket.OPEN) {
		ws?.close();
		ws = null;
	}

	connect();
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
		void handlePush(request);

		return;
	}

	if (request?.type === 'views-request') {
		void handleViewsRequest(request);

		return;
	}

	if (request?.type === 'view-details-request') {
		void handleViewDetailsRequest(request);

		return;
	}

	if (request && isExplorerRequest(request)) {
		void handleExplorerRequest(request);

		return;
	}

	if (request && isMetroRequest(request)) {
		reply(answerMetro(request));

		return;
	}

	if (request?.type === 'view-highlight') {
		highlightView(request.node);

		return;
	}

	if (request?.type === 'react-devtools') {
		receive(request, reply);
	}
}

async function handleViewsRequest(request: ViewsRequest) {
	reply(await listViews(request));
}

async function handleViewDetailsRequest(request: ViewDetailsRequest) {
	reply(await describeView(request));
}

async function handleExplorerRequest(request: ExplorerRequest) {
	reply(await answerExplorer(request));
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
function runtimeBytecode(request: PushRequest): string | undefined {
	const version = getLoader()?.bytecodeVersion;

	return version ? request.bytecode?.[String(version)] : void 0;
}

async function handlePush(request: PushRequest) {
	const manager = request.kind === 'theme' ? themes : plugins;

	try {
		const result = await manager.reload(
			request.addonId,
			request.bundle,
			request.manifest,
			runtimeBytecode(request),
			request.files,
		);

		if (result.ok) {
			manager.markDevelopmentCopy(request.addonId);
		}

		reply(
			result.ok
				? { type: 'plugin-push-result', id: request.id, ok: true }
				: {
						type: 'plugin-push-result',
						id: request.id,
						ok: false,
						error: inspect(result.error),
					},
		);
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

function reply(
	payload:
		| EvalResult
		| PushResult
		| ViewsResult
		| ViewDetailsResult
		| ExplorerResult
		| MetroResult
		| ReactDevtoolsFrame,
) {
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
function logFrame(message: unknown, level: unknown): LogMessage {
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
				stopDiscovery();

				if (ws?.readyState === WebSocket.OPEN) {
					ws.close();
				}

				break;
		}
	});

	return () => subscription.remove();
}

function listenToSettings() {
	return onChange(
		(payload) =>
			isSettingChange(payload, 'debugger.enabled') ||
			isSettingChange(payload, 'debugger.address'),
		(payload) => {
			if (isSettingChange(payload, 'debugger.enabled')) {
				if (payload.value) {
					start();
				} else {
					stop();
				}

				return;
			}

			if (ws?.readyState !== WebSocket.OPEN) return;

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
	let reloaded: string[] = [];
	let reset: ReturnType<typeof setTimeout> | undefined;

	function onReloaded(addon: Addon) {
		reloaded.push(addon.name);
		clearTimeout(reset);
		reset = setTimeout(() => {
			reloaded = [];
		}, RELOAD_BATCH_MS);
		show({
			id: 'hot-reload',
			title: 'Hot reload',
			content: reloadSummary(reloaded),
		});
	}

	function onReloadError(addon: Addon, error: Error) {
		show({
			id: `reload:${addon.id}`,
			title: 'Hot reload failed',
			content: `${addon.name} failed to reload: ${error.message}`,
		});
	}

	const managers = [plugins, themes];

	for (const manager of managers) {
		manager.on('reloaded', onReloaded);
		manager.on('reload-error', onReloadError);
	}

	return [
		() => clearTimeout(reset),
		...managers.flatMap((manager) => [
			() => void manager.off('reloaded', onReloaded),
			() => void manager.off('reload-error', onReloadError),
		]),
	];
}

export default { start, stop, shouldStart };
