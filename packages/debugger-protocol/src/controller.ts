import type { EvalResult, LogMessage } from './index';

import { serializeMessage, parseMessage } from './index';

/**
 * The controller half of the bridge, from a separate process. Dials the bridge's `?mcp` endpoint,
 * issues id-correlated evals over that one socket, and settles each against the matching result the
 * bridge routes back. Used by the MCP server; auto-reconnects so it can outlive bridge restarts.
 */

interface PendingEval {
	resolve: (result: EvalResult) => void;
	timer: ReturnType<typeof setTimeout>;
	/** Console output seen between this eval's dispatch and its result, so side effects surface too. */
	logs: LogMessage[];
}

/** How long the client waits for a result before failing an eval (must exceed the bridge's own). */
const EVAL_TIMEOUT_MS = 15_000;

/** How long to wait between reconnection attempts when the bridge is unreachable. */
const RECONNECT_DELAY_MS = 1_000;

export class ControllerClient {
	private ws: WebSocket | null = null;
	private readonly pending = new Map<string, PendingEval>();
	private deviceConnected = false;
	private closed = false;

	constructor(private readonly url: string) {}

	/** @description Opens the socket and keeps it open, reconnecting on drop until {@link close}d. */
	connect() {
		if (this.closed) return;

		this.ws = new WebSocket(this.url);

		this.ws.addEventListener('message', (event) => this.onMessage(String(event.data)));
		this.ws.addEventListener('close', () => this.onClose());
		this.ws.addEventListener('error', () => this.ws?.close());
	}

	/** @description Tears the client down and fails any in-flight evals. Twin of {@link connect}. */
	close() {
		this.closed = true;
		this.ws?.close();

		for (const [id, entry] of this.pending) {
			clearTimeout(entry.timer);
			entry.resolve({
				type: 'eval-result',
				id,
				ok: false,
				error: 'Debugger client shut down.',
				logs: entry.logs,
			});
		}

		this.pending.clear();
	}

	/** @description Whether a device is currently connected to the bridge. */
	get isDeviceConnected(): boolean {
		return this.deviceConnected;
	}

	/**
	 * @description Sends code to the device via the bridge and resolves with its result. Fails fast
	 * if the socket isn't open or the bridge doesn't answer in time.
	 * @param code The JavaScript to evaluate on the device.
	 * @returns The device's {@link EvalResult}.
	 */
	evaluate(code: string): Promise<EvalResult> {
		const id = crypto.randomUUID();

		return new Promise<EvalResult>((resolve) => {
			if (this.ws?.readyState !== WebSocket.OPEN) {
				resolve({
					type: 'eval-result',
					id,
					ok: false,
					error: 'Not connected to the debugger bridge.',
				});
				return;
			}

			const logs: LogMessage[] = [];

			const timer = setTimeout(() => {
				this.pending.delete(id);
				resolve({
					type: 'eval-result',
					id,
					ok: false,
					error: `Evaluation timed out after ${EVAL_TIMEOUT_MS}ms.`,
					logs,
				});
			}, EVAL_TIMEOUT_MS);

			this.pending.set(id, { resolve, timer, logs });
			this.ws.send(serializeMessage({ type: 'eval', id, code }));
		});
	}

	private onMessage(raw: string) {
		const message = parseMessage(raw);
		if (!message) return;

		if (message.type === 'device-status') {
			this.deviceConnected = message.connected;
			return;
		}

		if (message.type === 'log') {
			// Logs aren't id-tagged by the device, so attribute each to every in-flight eval. For the
			// MCP's one-at-a-time use this is exact; concurrent evals get a superset, which is the right
			// tradeoff short of device-side per-eval log tagging.
			for (const entry of this.pending.values()) entry.logs.push(message);
			return;
		}

		if (message.type === 'eval-result') {
			const entry = this.pending.get(message.id);
			if (!entry) return;

			clearTimeout(entry.timer);
			this.pending.delete(message.id);
			// Return the captured side-effect logs alongside the value.
			entry.resolve({ ...message, logs: entry.logs });
		}
	}

	private onClose() {
		this.ws = null;
		this.deviceConnected = false;

		if (this.closed) return;
		setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
	}
}
