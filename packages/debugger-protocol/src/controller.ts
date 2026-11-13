import type { PushedManifest } from '@unbound-app/types';

import type { DeviceInfo, EvalResult, LogMessage, PushResult, PushedAddonKind } from './index';

import {
	BRIDGE_REPLY_GRACE_MS,
	PUSH_TIMEOUT_MS,
	resolveEvalTimeout,
	serializeMessage,
	parseMessage,
} from './index';
import { PendingRequests } from './pending-requests';

/**
 * The controller half of the bridge: dials the `?mcp` endpoint and settles id-correlated evals
 * against the results the bridge routes back. Reconnects so it outlives bridge restarts.
 */

type AddonPush = {
	addonId: string;
	kind?: PushedAddonKind;
	bundle: string;
	manifest: PushedManifest;
	bytecode?: Record<string, string>;
	files?: Record<string, string>;
};

const RECONNECT_DELAY_MS = 1_000;

type ControllerOptions = {
	/** Runs before every dial, such as starting the bridge when none listens; the dial waits for it. */
	// UNKNOWN: the dial only awaits it and ignores its value.
	beforeConnect?: () => Promise<unknown>;
};

export class ControllerClient {
	private ws: WebSocket | null = null;
	/** Each pending eval keeps the console output seen since its dispatch, so side effects surface too. */
	private readonly pending = new PendingRequests<EvalResult, LogMessage[]>();
	private readonly pendingPushes = new PendingRequests<PushResult>();
	private deviceConnected = false;
	private deviceInfo: DeviceInfo | undefined;
	private closed = false;
	private readonly url: string;
	private readonly beforeConnect: ControllerOptions['beforeConnect'];

	constructor(url: string, { beforeConnect }: ControllerOptions = {}) {
		this.url = url;
		this.beforeConnect = beforeConnect;
	}

	/** @description Opens the socket and keeps it open, reconnecting on drop until {@link close}d. */
	connect() {
		if (this.closed) return;

		if (!this.beforeConnect) {
			this.open();

			return;
		}

		// A failed hook still dials, so the reconnect loop keeps running.
		void this.beforeConnect()
			.catch(() => void 0)
			.then(() => this.open());
	}

	private open() {
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

		this.pending.failAll((id) => ({
			type: 'eval-result',
			id,
			ok: false,
			error: 'Debugger client shut down.',
			code: 'shut-down',
		}));
		this.pendingPushes.failAll((id) => ({
			type: 'plugin-push-result',
			id,
			ok: false,
			error: 'Debugger client shut down.',
			code: 'shut-down',
		}));
	}

	get isDeviceConnected(): boolean {
		return this.deviceConnected;
	}

	/** @description What the connected device reported about itself in its hello, once it has said hello. */
	get device(): DeviceInfo | undefined {
		return this.deviceInfo;
	}

	/**
	 * @description Sends code to the device via the bridge and resolves with its result. Fails fast
	 * if the socket isn't open or the bridge doesn't answer in time.
	 * @param code The JavaScript to evaluate on the device.
	 * @param timeout How long the bridge waits for the device, in milliseconds; the bridge's default when omitted.
	 * @returns The device's {@link EvalResult}.
	 */
	evaluate(code: string, timeout?: number): Promise<EvalResult> {
		const id = crypto.randomUUID();

		return new Promise<EvalResult>((resolve) => {
			if (this.ws?.readyState !== WebSocket.OPEN) {
				resolve({
					type: 'eval-result',
					id,
					ok: false,
					error: 'Not connected to the debugger bridge.',
					code: 'bridge-unreachable',
				});

				return;
			}

			const logs: LogMessage[] = [];
			const limit = resolveEvalTimeout(timeout);

			this.pending.add(id, {
				settle: (result) => resolve({ ...result, logs }),
				timeoutMs: limit + BRIDGE_REPLY_GRACE_MS,
				onTimeout: () => ({
					type: 'eval-result',
					id,
					ok: false,
					error: `Evaluation timed out after ${limit}ms.`,
					code: 'timeout',
				}),
				meta: logs,
			});
			this.ws.send(
				serializeMessage(
					timeout === void 0
						? { type: 'eval', id, code }
						: { type: 'eval', id, code, timeout },
				),
			);
		});
	}

	/**
	 * @description Pushes a freshly built plugin or theme to the device via the bridge and resolves with the
	 * device's reload outcome. Fails fast if the socket isn't open or the bridge doesn't answer in time.
	 * @param push The addon id plus the built bundle and manifest to swap in.
	 * @returns The device's {@link PushResult}.
	 */
	pushAddon(push: AddonPush): Promise<PushResult> {
		const id = crypto.randomUUID();

		return new Promise<PushResult>((resolve) => {
			if (this.ws?.readyState !== WebSocket.OPEN) {
				resolve({
					type: 'plugin-push-result',
					id,
					ok: false,
					error: 'Not connected to the debugger bridge.',
					code: 'bridge-unreachable',
				});

				return;
			}

			this.pendingPushes.add(id, {
				settle: resolve,
				timeoutMs: PUSH_TIMEOUT_MS + BRIDGE_REPLY_GRACE_MS,
				onTimeout: () => ({
					type: 'plugin-push-result',
					id,
					ok: false,
					error: `Push timed out after ${PUSH_TIMEOUT_MS}ms.`,
					code: 'timeout',
				}),
				meta: void 0,
			});
			this.ws.send(serializeMessage({ type: 'plugin-push', id, ...push }));
		});
	}

	private onMessage(raw: string) {
		const message = parseMessage(raw);

		if (!message) return;

		if (message.type === 'device-status') {
			this.deviceConnected = message.connected;
			this.deviceInfo = message.connected ? message.device : void 0;

			return;
		}

		if (message.type === 'log') {
			// Device logs carry no eval id, so each goes to every in-flight eval. Exact for the MCP's
			// one-at-a-time use; concurrent evals get a superset.
			for (const logs of this.pending.metas()) logs.push(message);

			return;
		}

		if (message.type === 'eval-result') {
			this.pending.resolve(message.id, message);

			return;
		}

		if (message.type !== 'plugin-push-result') return;

		this.pendingPushes.resolve(message.id, message);
	}

	private onClose() {
		this.ws = null;
		this.deviceConnected = false;

		if (this.closed) return;

		setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
	}
}
