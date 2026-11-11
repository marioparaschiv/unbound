import { lowerForHermes } from '@unbound-app/cli/hermes-code';
import {
	CONTROLLER_ENDPOINT_MARKER,
	type EvalResult,
	type RequestFailureCode,
} from '@unbound-app/debugger-protocol';
import { ControllerClient } from '@unbound-app/debugger-protocol/controller';

import { waitFor } from './wait-for';

/** The bridge controller calls the matrix makes; the real {@link ControllerClient} or a test's fake. */
export type BridgeClient = Pick<
	ControllerClient,
	'connect' | 'close' | 'evaluate' | 'isDeviceConnected'
>;

export type DeviceBridge = {
	/** Evaluates a script in Discord and resolves with its string result; rejects with {@link DeviceDropped} when the device went away. */
	evaluate(code: string): Promise<string>;
	/** Resolves `true` once a device is connected to the bridge, or `false` after `timeoutMs`. */
	waitForDevice(timeoutMs: number): Promise<boolean>;
	close(): void;
};

const EVAL_TIMEOUT_MS = 60_000;
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_WAIT_MS = 5_000;
const DEVICE_POLL_MS = 100;

/** The failure codes that mean the device is gone rather than that the script failed. */
const DROPPED_CODES: ReadonlySet<RequestFailureCode> = new Set([
	'no-device',
	'device-disconnected',
	'bridge-unreachable',
]);

/** The device went away before it answered, named by the protocol's failure code. */
export class DeviceDropped extends Error {
	readonly code: RequestFailureCode;

	constructor(code: RequestFailureCode, message: string) {
		super(message);
		this.name = 'DeviceDropped';
		this.code = code;
	}
}

/**
 * @description Whether an error says the device went away, so the matrix relaunches Discord instead of failing.
 * @param error What an evaluation threw.
 * @returns `true` for a {@link DeviceDropped}.
 */
export function isDisconnect(error: unknown): error is DeviceDropped {
	return error instanceof DeviceDropped;
}

/**
 * @description Reads an eval result as the script's value.
 * @param result What the bridge answered.
 * @returns The value; throws {@link DeviceDropped} for a dropped device, or an `Evaluation failed` error otherwise.
 */
export function readEvalResult(result: EvalResult): string {
	if (result.ok) return result.value;

	if (result.code && DROPPED_CODES.has(result.code)) {
		throw new DeviceDropped(result.code, `Device disconnected: ${result.error}`);
	}

	throw new Error(`Evaluation failed: ${JSON.stringify(result.error)}`);
}

/**
 * @description Connects to the debugger bridge as a controller, retrying an evaluation the device dropped once it reconnects.
 * @param port The bridge's port.
 * @param client The controller; a real one dialing the port unless a test passes its own.
 * @returns The bridge, open until {@link DeviceBridge.close}.
 */
export function connectBridge(
	port: number,
	client: BridgeClient = new ControllerClient(
		`ws://127.0.0.1:${port}?${CONTROLLER_ENDPOINT_MARKER}`,
	),
): DeviceBridge {
	const waitForDevice = (timeoutMs: number) =>
		waitFor(async () => client.isDeviceConnected, { timeoutMs, intervalMs: DEVICE_POLL_MS });

	async function evaluate(code: string): Promise<string> {
		const lowered = lowerForHermes(code);

		for (let retry = 0; ; retry++) {
			try {
				return readEvalResult(await client.evaluate(lowered, EVAL_TIMEOUT_MS));
			} catch (error) {
				if (retry >= RECONNECT_ATTEMPTS || !isDisconnect(error)) throw error;

				console.error(`Device disconnected (${error.code}), waiting for it to reconnect.`);
				await waitForDevice(RECONNECT_WAIT_MS);
			}
		}
	}

	client.connect();

	return { evaluate, waitForDevice, close: () => client.close() };
}

export default { connectBridge, isDisconnect, readEvalResult };
