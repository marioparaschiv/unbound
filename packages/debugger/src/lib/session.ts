import type {
	DeviceInfo,
	DeviceStatus,
	LogMessage,
	EvalResult,
	EvalRequest,
	BridgeMessage,
	ExplorerRequest,
	MetroRequest,
	PushResult,
	PushRequest,
	ReactDevtoolsFrame,
	ViewDetailsRequest,
	ViewDetailsResult,
	ViewHighlight,
	ViewsRequest,
	ViewsResult,
} from '@unbound-app/debugger-protocol';
import {
	DEFAULT_EVAL_TIMEOUT_MS,
	PUSH_TIMEOUT_MS,
	REACT_DEVTOOLS_SHUTDOWN_EVENT,
	isExplorerResult,
	isMetroResult,
	resolveEvalTimeout,
	serializeMessage,
} from '@unbound-app/debugger-protocol';
import { PendingRequests } from '@unbound-app/debugger-protocol/pending-requests';

import { discardExplorer, failExplorer, requestExplorer, settleExplorer } from './explorer-session';
import { discardMetro, failMetro, requestMetro, settleMetro } from './metro-session';

/**
 * The bridge's transport-agnostic routing core: routes each eval result back to the controller that
 * issued it and fans telemetry out to every listener.
 */

/** The minimal socket surface the session needs, satisfied by `Bun.ServerWebSocket`. */
export type SocketLike = {
	send(data: string): void;
	close(): void;
};

export const state: {
	device: SocketLike | null;
	deviceInfo: DeviceInfo | null;
	controllers: Set<SocketLike>;
	/** The controller acting as the React DevTools frontend: the last one to send a React DevTools frame. */
	reactDevtools: SocketLike | null;
} = {
	device: null,
	deviceInfo: null,
	controllers: new Set(),
	reactDevtools: null,
};

// Each pending request keeps the controller that issued it (none for the REPL), so a controller
// detach can drop its in-flight requests.
const pending = new PendingRequests<EvalResult, SocketLike | undefined>();
const pendingPushes = new PendingRequests<PushResult, SocketLike>();
const pendingViews = new PendingRequests<ViewsResult, SocketLike>();
const pendingDetails = new PendingRequests<ViewDetailsResult, SocketLike>();
const logListeners = new Set<(log: LogMessage) => void>();
const deviceListeners = new Set<(connected: boolean, device: DeviceInfo | null) => void>();
const evalListeners = new Set<(code: string) => void>();
const resultListeners = new Set<(result: EvalResult) => void>();
const controllerListeners = new Set<(connected: boolean, count: number) => void>();

const VIEWS_TIMEOUT_MS = 15_000;

/**
 * @description Registers the connected device, replacing any earlier one so a relaunched or
 * reconnecting app always takes over from a socket that died without closing.
 * @param socket The device's socket.
 */
export function attachDevice(socket: SocketLike) {
	const previous = state.device;

	if (previous) {
		detachDevice(previous);
		previous.close();
	}

	state.device = socket;
	broadcastDeviceStatus(true);
}

/**
 * @description Clears the device on disconnect, notifies controllers, and fails every in-flight eval
 * so no caller waits forever. Twin of {@link attachDevice}.
 * @param socket The socket that closed; ignored if it isn't the current device.
 */
export function detachDevice(socket: SocketLike) {
	if (state.device !== socket) return;

	state.device = null;
	state.deviceInfo = null;

	pending.failAll((id) => ({
		type: 'eval-result',
		id,
		ok: false,
		error: 'Device disconnected before the evaluation completed.',
		code: 'device-disconnected',
	}));
	pendingPushes.failAll((id) => ({
		type: 'plugin-push-result',
		id,
		ok: false,
		error: 'Device disconnected before the reload completed.',
		code: 'device-disconnected',
	}));

	pendingViews.failAll((id) => ({
		type: 'views-result',
		id,
		ok: false,
		error: 'Device disconnected before the views were listed.',
	}));
	pendingDetails.failAll((id) => ({
		type: 'view-details-result',
		id,
		ok: false,
		error: 'Device disconnected before the view was read.',
	}));
	failExplorer();
	failMetro();

	broadcastDeviceStatus(false);
}

/** @description Adds a controller and immediately reports current device presence to it. */
export function attachController(socket: SocketLike) {
	state.controllers.add(socket);
	sendDeviceStatus(socket, Boolean(state.device));

	for (const listener of controllerListeners) listener(true, state.controllers.size);
}

/**
 * @description Removes a controller and fails any of its in-flight evals. Twin of
 * {@link attachController}.
 * @param socket The controller that closed.
 */
export function detachController(socket: SocketLike) {
	state.controllers.delete(socket);

	pending.discard((origin) => origin === socket);
	pendingPushes.discard((origin) => origin === socket);
	pendingViews.discard((origin) => origin === socket);
	pendingDetails.discard((origin) => origin === socket);
	discardExplorer(socket);
	discardMetro(socket);

	if (state.reactDevtools === socket) {
		state.reactDevtools = null;
		// Ends the device's backend session, so it stops sending a tree nobody reads.
		sendToDevice({ type: 'react-devtools', event: REACT_DEVTOOLS_SHUTDOWN_EVENT });
	}

	for (const listener of controllerListeners) listener(false, state.controllers.size);
}

/**
 * @description Runs code on the device on behalf of a controller socket, delivering the id-correlated
 * result back over that same socket. Sends an error frame instead if no device is connected.
 * @param socket The controller that issued the request.
 * @param request The controller's eval, whose `id` correlates the result and whose `timeout` bounds the wait.
 */
export function evaluateForController(socket: SocketLike, request: EvalRequest) {
	const { id, code } = request;

	// Surface controller (MCP) activity so an observer like the terminal can show a full transcript,
	// not just the device's own console output.
	for (const listener of evalListeners) listener(code);

	dispatch(id, code, resolveEvalTimeout(request.timeout), socket, (result) => {
		for (const listener of resultListeners) listener(result);

		socket.send(serializeMessage(result));
	});
}

/**
 * @description Forwards a controller's {@link PushRequest} to the device and delivers the
 * id-correlated {@link PushResult} back over that same controller's socket. Replies with an
 * error frame instead if no device is connected or it doesn't answer within {@link PUSH_TIMEOUT_MS}.
 * @param socket The controller that issued the push.
 * @param request The push to forward verbatim; its `id` correlates the result.
 */
export function pushForController(socket: SocketLike, request: PushRequest) {
	const deliver = (result: PushResult) => socket.send(serializeMessage(result));

	if (!state.device) {
		deliver({
			type: 'plugin-push-result',
			id: request.id,
			ok: false,
			error: 'No device is connected to the debugger.',
			code: 'no-device',
		});

		return;
	}

	pendingPushes.add(request.id, {
		settle: deliver,
		timeoutMs: PUSH_TIMEOUT_MS,
		onTimeout: () => ({
			type: 'plugin-push-result',
			id: request.id,
			ok: false,
			error: `Push timed out after ${PUSH_TIMEOUT_MS}ms.`,
			code: 'timeout',
		}),
		meta: socket,
	});
	state.device.send(serializeMessage(request));
}

/**
 * @description Forwards a controller's {@link ViewsRequest} to the device and delivers the id-correlated
 * {@link ViewsResult} back over that same controller's socket, or an error when no device answers.
 * @param socket The controller that asked.
 * @param request The request to forward verbatim; its `id` correlates the result.
 */
export function requestViewsForController(socket: SocketLike, request: ViewsRequest) {
	const deliver = (result: ViewsResult) => socket.send(serializeMessage(result));

	if (!state.device) {
		deliver({
			type: 'views-result',
			id: request.id,
			ok: false,
			error: 'No device is connected to the debugger.',
		});

		return;
	}

	pendingViews.add(request.id, {
		settle: deliver,
		timeoutMs: VIEWS_TIMEOUT_MS,
		onTimeout: () => ({
			type: 'views-result',
			id: request.id,
			ok: false,
			error: `Listing views timed out after ${VIEWS_TIMEOUT_MS}ms.`,
		}),
		meta: socket,
	});
	state.device.send(serializeMessage(request));
}

/**
 * @description Forwards a controller's {@link ViewDetailsRequest} to the device and delivers the
 * id-correlated {@link ViewDetailsResult} back over that same controller's socket, or an error when no device answers.
 * @param socket The controller that asked.
 * @param request The request to forward verbatim; its `id` correlates the result.
 */
export function requestViewDetailsForController(socket: SocketLike, request: ViewDetailsRequest) {
	const deliver = (result: ViewDetailsResult) => socket.send(serializeMessage(result));

	if (!state.device) {
		deliver({
			type: 'view-details-result',
			id: request.id,
			ok: false,
			error: 'No device is connected to the debugger.',
		});

		return;
	}

	pendingDetails.add(request.id, {
		settle: deliver,
		timeoutMs: VIEWS_TIMEOUT_MS,
		onTimeout: () => ({
			type: 'view-details-result',
			id: request.id,
			ok: false,
			error: `Reading the view timed out after ${VIEWS_TIMEOUT_MS}ms.`,
		}),
		meta: socket,
	});
	state.device.send(serializeMessage(request));
}

/**
 * @description Forwards a controller's object explorer request to the device and routes its answer back to that
 * controller, or fails it when no device answers.
 * @param socket The controller that asked.
 * @param request The request to forward verbatim; its `id` correlates the result.
 */
export function requestExplorerForController(socket: SocketLike, request: ExplorerRequest) {
	requestExplorer(state.device, socket, request);
}

/**
 * @description Forwards a controller's Metro request to the device and routes its answer back to that
 * controller, or fails it when no device answers.
 * @param socket The controller that asked.
 * @param request The request to forward verbatim; its `id` correlates the result.
 */
export function requestMetroForController(socket: SocketLike, request: MetroRequest) {
	requestMetro(state.device, socket, request);
}

/**
 * @description Forwards a controller's {@link ViewHighlight} to the device; it has no answer.
 * @param highlight The view to outline, or `null` to clear the outline.
 */
export function highlightView(highlight: ViewHighlight) {
	sendToDevice(highlight);
}

/**
 * @description Forwards a controller's React DevTools frame to the device and makes that controller
 * the frontend, the one the device's React DevTools frames go back to.
 * @param socket The controller that sent the frame.
 * @param frame The frame to forward verbatim.
 */
export function relayReactDevtools(socket: SocketLike, frame: ReactDevtoolsFrame) {
	state.reactDevtools = socket;
	sendToDevice(frame);
}

function sendToDevice(message: BridgeMessage) {
	state.device?.send(serializeMessage(message));
}

/**
 * @description Runs code on the device on behalf of an in-process caller (the terminal REPL),
 * resolving with the device's answer. Rejects if no device is connected or it doesn't answer within
 * {@link DEFAULT_EVAL_TIMEOUT_MS}.
 * @param code The JavaScript to evaluate on the device.
 * @returns The device's {@link EvalResult}.
 */
export function evaluate(code: string): Promise<EvalResult> {
	return new Promise<EvalResult>((resolve) => {
		dispatch(crypto.randomUUID(), code, DEFAULT_EVAL_TIMEOUT_MS, void 0, resolve);
	});
}

function dispatch(
	id: string,
	code: string,
	timeout: number,
	origin: SocketLike | undefined,
	deliver: (result: EvalResult) => void,
) {
	if (!state.device) {
		deliver({
			type: 'eval-result',
			id,
			ok: false,
			error: 'No device is connected to the debugger.',
			code: 'no-device',
		});

		return;
	}

	pending.add(id, {
		settle: deliver,
		timeoutMs: timeout,
		onTimeout: () => ({
			type: 'eval-result',
			id,
			ok: false,
			error: `Evaluation timed out after ${timeout}ms.`,
			code: 'timeout',
		}),
		meta: origin,
	});
	state.device.send(serializeMessage({ type: 'eval', id, code }));
}

/**
 * @description Routes a single parsed frame arriving from the device: an eval result settles its
 * pending request, a log line fans out to controllers and local listeners.
 * @param message The framed message received from the device.
 */
export function handleDeviceMessage(message: BridgeMessage) {
	if (message.type === 'eval-result') {
		pending.resolve(message.id, message);

		return;
	}

	if (message.type === 'plugin-push-result') {
		pendingPushes.resolve(message.id, message);

		return;
	}

	if (message.type === 'views-result') {
		pendingViews.resolve(message.id, message);

		return;
	}

	if (message.type === 'view-details-result') {
		pendingDetails.resolve(message.id, message);

		return;
	}

	if (isExplorerResult(message)) {
		settleExplorer(message);

		return;
	}

	if (isMetroResult(message)) {
		settleMetro(message);

		return;
	}

	if (message.type === 'react-devtools') {
		state.reactDevtools?.send(serializeMessage(message));

		return;
	}

	if (message.type === 'hello') {
		state.deviceInfo = message.device;
		broadcastDeviceStatus(true);

		return;
	}

	if (message.type !== 'log') return;

	for (const socket of state.controllers) socket.send(serializeMessage(message));

	for (const listener of logListeners) listener(message);
}

/**
 * @description Subscribes to device log lines.
 * @param listener Called with each log line.
 * @returns An unsubscribe function.
 */
export function onLog(listener: (log: LogMessage) => void): () => void {
	logListeners.add(listener);

	return () => void logListeners.delete(listener);
}

/**
 * @description Subscribes to device connect/disconnect transitions.
 * @param listener Called with whether a device is now connected.
 * @returns An unsubscribe function.
 */
export function onDevice(
	listener: (connected: boolean, device: DeviceInfo | null) => void,
): () => void {
	deviceListeners.add(listener);

	return () => void deviceListeners.delete(listener);
}

/**
 * @description Subscribes to code a controller (e.g. the MCP) sends to evaluate.
 * @param listener Called with each controller's code.
 * @returns An unsubscribe function.
 */
export function onControllerEval(listener: (code: string) => void): () => void {
	evalListeners.add(listener);

	return () => void evalListeners.delete(listener);
}

/**
 * @description Subscribes to the results of controller evals.
 * @param listener Called with each controller eval's result.
 * @returns An unsubscribe function.
 */
export function onControllerResult(listener: (result: EvalResult) => void): () => void {
	resultListeners.add(listener);

	return () => void resultListeners.delete(listener);
}

/**
 * @description Subscribes to controller (MCP) connect/disconnect transitions.
 * @param listener Called with the transition and the resulting controller count.
 * @returns An unsubscribe function.
 */
export function onController(listener: (connected: boolean, count: number) => void): () => void {
	controllerListeners.add(listener);

	return () => void controllerListeners.delete(listener);
}

function sendDeviceStatus(socket: SocketLike, connected: boolean) {
	const status: DeviceStatus = connected
		? { type: 'device-status', connected, device: state.deviceInfo ?? void 0 }
		: { type: 'device-status', connected };

	socket.send(serializeMessage(status));
}

function broadcastDeviceStatus(connected: boolean) {
	for (const socket of state.controllers) sendDeviceStatus(socket, connected);

	for (const listener of deviceListeners) listener(connected, state.deviceInfo);
}
