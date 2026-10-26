import type {
	LogMessage,
	EvalResult,
	EvalRequest,
	BridgeMessage,
	PluginPushResult,
	PluginPushRequest,
} from '@unbound-app/debugger-protocol';
import { DEFAULT_EVAL_TIMEOUT_MS, MAX_EVAL_TIMEOUT_MS } from '@unbound-app/debugger-protocol';

/**
 * The bridge's transport-agnostic routing core: routes each eval result back to the controller that
 * issued it and fans telemetry out to every listener.
 */

/** The minimal socket surface the session needs, satisfied by `Bun.ServerWebSocket`. */
export type SocketLike = {
	send(data: string): void;
	close(): void;
};

type PendingEval = {
	/** Delivers the device's answer back to whoever issued this eval (a socket, or the REPL). */
	deliver: (result: EvalResult) => void;
	timer: ReturnType<typeof setTimeout>;
};

type PendingPush = {
	/** Delivers the device's reload outcome back to the controller that issued the push. */
	deliver: (result: PluginPushResult) => void;
	timer: ReturnType<typeof setTimeout>;
	/** The controller that issued this push, so a controller detach can fail its in-flight pushes. */
	origin: SocketLike;
};

export const state: {
	device: SocketLike | null;
	controllers: Set<SocketLike>;
} = {
	device: null,
	controllers: new Set(),
};

const pending = new Map<string, PendingEval>();
const pendingPushes = new Map<string, PendingPush>();
const logListeners = new Set<(log: LogMessage) => void>();
const deviceListeners = new Set<(connected: boolean) => void>();
const evalListeners = new Set<(code: string) => void>();
const resultListeners = new Set<(result: EvalResult) => void>();
const controllerListeners = new Set<(connected: boolean, count: number) => void>();

const PLUGIN_PUSH_TIMEOUT_MS = 60_000;

/**
 * @description Registers the connected device, rejecting a second one so eval routing stays
 * unambiguous.
 * @param socket The device's socket.
 * @returns Whether the device was accepted (false if one is already connected).
 */
export function attachDevice(socket: SocketLike): boolean {
	if (state.device) {
		return false;
	}

	state.device = socket;
	broadcastDeviceStatus(true);

	return true;
}

/**
 * @description Clears the device on disconnect, notifies controllers, and fails every in-flight eval
 * so no caller waits forever. Twin of {@link attachDevice}.
 * @param socket The socket that closed; ignored if it isn't the current device.
 */
export function detachDevice(socket: SocketLike) {
	if (state.device !== socket) return;

	state.device = null;

	for (const [id, entry] of pending) {
		clearTimeout(entry.timer);
		entry.deliver({
			type: 'eval-result',
			id,
			ok: false,
			error: 'Device disconnected before the evaluation completed.',
		});
		pending.delete(id);
	}

	for (const [id, entry] of pendingPushes) {
		clearTimeout(entry.timer);
		entry.deliver({
			type: 'plugin-push-result',
			id,
			ok: false,
			error: 'Device disconnected before the reload completed.',
		});
		pendingPushes.delete(id);
	}

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

	for (const [id, entry] of pending) {
		if (entry.deliver !== controllerDelivery.get(socket)) {
			continue;
		}

		clearTimeout(entry.timer);
		pending.delete(id);
	}

	for (const [id, entry] of pendingPushes) {
		if (entry.origin !== socket) {
			continue;
		}

		clearTimeout(entry.timer);
		pendingPushes.delete(id);
	}

	controllerDelivery.delete(socket);

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
	const deliver = getControllerDelivery(socket);

	// Surface controller (MCP) activity so an observer like the terminal can show a full transcript,
	// not just the device's own console output.
	for (const listener of evalListeners) listener(code);

	dispatch(id, code, resolveEvalTimeout(request.timeout), (result) => {
		for (const listener of resultListeners) listener(result);

		deliver(result);
	});
}

/**
 * @description Picks how long an eval may run: the requested timeout when it is a positive number of
 * milliseconds, capped at {@link MAX_EVAL_TIMEOUT_MS}, otherwise {@link DEFAULT_EVAL_TIMEOUT_MS}.
 * @param requested The timeout the controller asked for, if any.
 * @returns The timeout to apply, in milliseconds.
 */
export function resolveEvalTimeout(requested: number | undefined): number {
	return typeof requested === 'number' && requested > 0
		? Math.min(requested, MAX_EVAL_TIMEOUT_MS)
		: DEFAULT_EVAL_TIMEOUT_MS;
}

/**
 * @description Forwards a controller's {@link PluginPushRequest} to the device and delivers the
 * id-correlated {@link PluginPushResult} back over that same controller's socket. Replies with an
 * error frame instead if no device is connected or it doesn't answer within {@link PLUGIN_PUSH_TIMEOUT_MS}.
 * @param socket The controller that issued the push.
 * @param request The push to forward verbatim; its `id` correlates the result.
 */
export function pushPluginForController(socket: SocketLike, request: PluginPushRequest) {
	const deliver = (result: PluginPushResult) => socket.send(JSON.stringify(result));

	if (!state.device) {
		deliver({
			type: 'plugin-push-result',
			id: request.id,
			ok: false,
			error: 'No device is connected to the debugger.',
		});

		return;
	}

	const timer = setTimeout(() => {
		pendingPushes.delete(request.id);
		deliver({
			type: 'plugin-push-result',
			id: request.id,
			ok: false,
			error: `Plugin push timed out after ${PLUGIN_PUSH_TIMEOUT_MS}ms.`,
		});
	}, PLUGIN_PUSH_TIMEOUT_MS);

	pendingPushes.set(request.id, { deliver, timer, origin: socket });
	state.device.send(JSON.stringify(request));
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
		dispatch(crypto.randomUUID(), code, DEFAULT_EVAL_TIMEOUT_MS, resolve);
	});
}

function dispatch(
	id: string,
	code: string,
	timeout: number,
	deliver: (result: EvalResult) => void,
) {
	if (!state.device) {
		deliver({
			type: 'eval-result',
			id,
			ok: false,
			error: 'No device is connected to the debugger.',
		});

		return;
	}

	const timer = setTimeout(() => {
		pending.delete(id);
		deliver({
			type: 'eval-result',
			id,
			ok: false,
			error: `Evaluation timed out after ${timeout}ms.`,
		});
	}, timeout);

	pending.set(id, { deliver, timer });
	state.device.send(JSON.stringify({ type: 'eval', id, code }));
}

/**
 * @description Routes a single parsed frame arriving from the device: an eval result settles its
 * pending request, a log line fans out to controllers and local listeners.
 * @param message The framed message received from the device.
 */
export function handleDeviceMessage(message: BridgeMessage) {
	if (message.type === 'eval-result') {
		const entry = pending.get(message.id);

		if (!entry) return;

		clearTimeout(entry.timer);
		pending.delete(message.id);
		entry.deliver(message);

		return;
	}

	if (message.type === 'plugin-push-result') {
		const entry = pendingPushes.get(message.id);

		if (!entry) return;

		clearTimeout(entry.timer);
		pendingPushes.delete(message.id);
		entry.deliver(message);

		return;
	}

	if (message.type !== 'log') return;

	for (const socket of state.controllers) socket.send(JSON.stringify(message));

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
export function onDevice(listener: (connected: boolean) => void): () => void {
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

// One stable delivery closure per controller so pending evals can be matched back to it on detach.
const controllerDelivery = new Map<SocketLike, (result: EvalResult) => void>();

function getControllerDelivery(socket: SocketLike): (result: EvalResult) => void {
	let deliver = controllerDelivery.get(socket);

	if (deliver) {
		return deliver;
	}

	deliver = (result) => socket.send(JSON.stringify(result));
	controllerDelivery.set(socket, deliver);

	return deliver;
}

function sendDeviceStatus(socket: SocketLike, connected: boolean) {
	socket.send(JSON.stringify({ type: 'device-status', connected }));
}

function broadcastDeviceStatus(connected: boolean) {
	for (const socket of state.controllers) sendDeviceStatus(socket, connected);

	for (const listener of deviceListeners) listener(connected);
}
