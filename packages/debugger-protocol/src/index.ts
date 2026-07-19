/**
 * The wire protocol shared by the bridge, the on-device debugger, and any controller (the terminal
 * REPL or an MCP client). Everything crossing a socket is a JSON-encoded {@link BridgeMessage}.
 *
 * Two planes travel over the single device socket:
 *   - control: a controller issues an {@link EvalRequest}; the device answers with the matching
 *     {@link EvalResult} (correlated by `id`).
 *   - telemetry: the device streams {@link LogMessage}s, broadcast to every controller.
 *
 * Device-safe and dependency-free so it can be bundled into the React Native client.
 */

/** A request to evaluate code on the device, sent controller → bridge → device. */
export interface EvalRequest {
	type: 'eval';
	/** Correlation id echoed back on the matching {@link EvalResult}. */
	id: string;
	code: string;
}

/** The outcome of an {@link EvalRequest}, sent device → bridge → the one waiting controller. */
export interface EvalResult {
	type: 'eval-result';
	/** The `id` of the {@link EvalRequest} this answers. */
	id: string;
	ok: boolean;
	/** Present when `ok`; the inspected return value. */
	value?: string;
	/** Present when `!ok`; the inspected error. */
	error?: string;
	/**
	 * Console output captured on the device for the duration of this eval, so a caller sees the
	 * side effects (`console.log`s) the code produced, not just its return value. Populated by the
	 * controller that owns the request, not sent by the device.
	 */
	logs?: LogMessage[];
}

/** A `console.*` / `nativeLoggingHook` line, streamed device → bridge → all controllers. */
export interface LogMessage {
	type: 'log';
	/** 1 = log/gray, 2 = warn/yellow, 3 = error/red. */
	level: 1 | 2 | 3;
	message: string;
}

/** Bridge → controller, once on attach and whenever the device connects or drops. */
export interface DeviceStatus {
	type: 'device-status';
	connected: boolean;
}

/** Every framed message on the wire. */
export type BridgeMessage = EvalRequest | EvalResult | LogMessage | DeviceStatus;

/** The default port the bridge listens on and controllers dial. */
export const DEFAULT_BRIDGE_PORT = 9090;

/** The query marker a controller appends to its URL so the bridge routes it as a controller, not a device. */
export const CONTROLLER_ENDPOINT_MARKER = 'mcp';

const MESSAGE_TYPES = new Set<BridgeMessage['type']>([
	'eval',
	'eval-result',
	'log',
	'device-status',
]);

/**
 * @description Safely parses a raw wire frame into a {@link BridgeMessage}, guarding against invalid
 * JSON and unknown shapes so both ends can trust what they route.
 * @param raw The JSON string received off the socket.
 * @returns The parsed message, or `undefined` if it isn't a recognised frame.
 */
export function parseMessage(raw: string): BridgeMessage | undefined {
	let value: unknown;

	try {
		value = JSON.parse(raw);
	} catch {
		return void 0;
	}

	if (typeof value !== 'object' || value === null) return void 0;

	const type = (value as { type?: unknown }).type;
	if (typeof type !== 'string' || !MESSAGE_TYPES.has(type as BridgeMessage['type']))
		return void 0;

	return value as BridgeMessage;
}

/**
 * @description Serialises a {@link BridgeMessage} into its wire form. Inverse of {@link parseMessage}.
 * @param message The message to frame.
 * @returns The JSON string to send over the socket.
 */
export function serializeMessage(message: BridgeMessage): string {
	return JSON.stringify(message);
}
export default {
	DEFAULT_BRIDGE_PORT,
	CONTROLLER_ENDPOINT_MARKER,
	parseMessage,
	serializeMessage,
};
