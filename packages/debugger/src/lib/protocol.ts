/**
 * The wire protocol shared by the bridge, the on-device debugger, and any controller (the terminal
 * REPL or an MCP client). Everything crossing a socket is a JSON-encoded {@link BridgeMessage}.
 *
 * Two planes travel over the single device socket:
 *   - control: a controller issues an {@link EvalRequest}; the device answers with the matching
 *     {@link EvalResult} (correlated by `id`).
 *   - telemetry: the device streams {@link LogMessage}s, broadcast to every controller.
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
