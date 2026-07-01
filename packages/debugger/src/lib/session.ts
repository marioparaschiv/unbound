import uuid from '@unbound-app/utils/uuid';

import type { BridgeMessage, EvalResult, LogMessage } from './protocol';

/**
 * The bridge's routing core, transport-agnostic. Holds the single device socket and the set of
 * controllers, correlates each eval request to the controller that issued it (so the result goes
 * back to exactly one place), and fans telemetry out to every listener. {@link ws.ts} feeds sockets
 * into this; the terminal REPL consumes it in-process.
 */

/** The minimal socket surface the session needs, satisfied by `Bun.ServerWebSocket`. */
export interface SocketLike {
	send(data: string): unknown;
	close(): unknown;
}

interface PendingEval {
	/** Delivers the device's answer back to whoever issued this eval (a socket, or the REPL). */
	deliver: (result: EvalResult) => void;
	timer: ReturnType<typeof setTimeout>;
}

export const state: {
	device: SocketLike | null;
	controllers: Set<SocketLike>;
} = {
	device: null,
	controllers: new Set(),
};

const pending = new Map<string, PendingEval>();
const logListeners = new Set<(log: LogMessage) => void>();
const deviceListeners = new Set<(connected: boolean) => void>();
const evalListeners = new Set<(code: string) => void>();
const resultListeners = new Set<(result: EvalResult) => void>();
const controllerListeners = new Set<(connected: boolean, count: number) => void>();

/** How long to wait for a device to answer an eval before failing it. */
export const EVAL_TIMEOUT_MS = 10_000;

/**
 * @description Registers the connected device, rejecting a second one so eval routing stays
 * unambiguous.
 * @param socket The device's socket.
 * @returns Whether the device was accepted (false if one is already connected).
 */
export function attachDevice(socket: SocketLike): boolean {
	if (state.device) return false;

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
		if (entry.deliver !== controllerDelivery.get(socket)) continue;
		clearTimeout(entry.timer);
		pending.delete(id);
	}

	controllerDelivery.delete(socket);

	for (const listener of controllerListeners) listener(false, state.controllers.size);
}

/**
 * @description Runs code on the device on behalf of a controller socket, delivering the id-correlated
 * result back over that same socket. Sends an error frame instead if no device is connected.
 * @param socket The controller that issued the request.
 * @param id The controller-chosen correlation id, echoed on the result.
 * @param code The JavaScript to evaluate on the device.
 */
export function evaluateForController(socket: SocketLike, id: string, code: string) {
	const deliver = getControllerDelivery(socket);

	// Surface controller (MCP) activity so an observer like the terminal can show a full transcript,
	// not just the device's own console output.
	for (const listener of evalListeners) listener(code);

	dispatch(id, code, (result) => {
		for (const listener of resultListeners) listener(result);
		deliver(result);
	});
}

/**
 * @description Runs code on the device on behalf of an in-process caller (the terminal REPL),
 * resolving with the device's answer. Rejects if no device is connected or it doesn't answer within
 * {@link EVAL_TIMEOUT_MS}.
 * @param code The JavaScript to evaluate on the device.
 * @returns The device's {@link EvalResult}.
 */
export function evaluate(code: string): Promise<EvalResult> {
	return new Promise<EvalResult>((resolve) => {
		dispatch(uuid(), code, resolve);
	});
}

function dispatch(id: string, code: string, deliver: (result: EvalResult) => void) {
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
			error: `Evaluation timed out after ${EVAL_TIMEOUT_MS}ms.`,
		});
	}, EVAL_TIMEOUT_MS);

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

	if (message.type === 'log') {
		for (const socket of state.controllers) socket.send(JSON.stringify(message));
		for (const listener of logListeners) listener(message);
	}
}

/** @description Subscribes to device log lines; returns an unsubscribe function. */
export function onLog(listener: (log: LogMessage) => void): () => void {
	logListeners.add(listener);
	return () => void logListeners.delete(listener);
}

/** @description Subscribes to device connect/disconnect transitions; returns an unsubscribe function. */
export function onDevice(listener: (connected: boolean) => void): () => void {
	deviceListeners.add(listener);
	return () => void deviceListeners.delete(listener);
}

/** @description Subscribes to code a controller (e.g. the MCP) sends to evaluate; returns an unsubscribe function. */
export function onControllerEval(listener: (code: string) => void): () => void {
	evalListeners.add(listener);
	return () => void evalListeners.delete(listener);
}

/** @description Subscribes to the results of controller evals; returns an unsubscribe function. */
export function onControllerResult(listener: (result: EvalResult) => void): () => void {
	resultListeners.add(listener);
	return () => void resultListeners.delete(listener);
}

/**
 * @description Subscribes to controller (MCP) connect/disconnect transitions, with the resulting
 * controller count; returns an unsubscribe function.
 */
export function onController(listener: (connected: boolean, count: number) => void): () => void {
	controllerListeners.add(listener);
	return () => void controllerListeners.delete(listener);
}

// One stable delivery closure per controller so pending evals can be matched back to it on detach.
const controllerDelivery = new Map<SocketLike, (result: EvalResult) => void>();

function getControllerDelivery(socket: SocketLike): (result: EvalResult) => void {
	let deliver = controllerDelivery.get(socket);
	if (deliver) return deliver;

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
