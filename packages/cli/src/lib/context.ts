import type { CommandContext } from '@unbound-app/debugger-protocol/registry';
import { ControllerClient } from '@unbound-app/debugger-protocol/controller';
import { CONTROLLER_ENDPOINT_MARKER } from '@unbound-app/debugger-protocol';

/** How long a one-shot command waits for the bridge to report a device before giving up. */
const DEVICE_WAIT_TIMEOUT_MS = 2_000;

/** How often the device-wait polls the controller's connection state. */
const DEVICE_WAIT_POLL_MS = 50;

/**
 * A {@link CommandContext} whose controller is dialed lazily: commands that never touch the bridge
 * (`build`, `dev`) trigger no connection, so they run with no bridge present. `close` tears the
 * client down only if it was ever created.
 */
export type LazyContext = CommandContext & {
	/** Whether the controller was ever dialed, i.e. the command actually used the bridge. */
	readonly connected: boolean;
	close(): void;
};

/**
 * @description Builds a {@link LazyContext} whose controller dials the bridge on the given port on
 * first access to `client`, attaching as a controller through the shared endpoint marker rather than
 * as a device. Commands that never read `client` never connect.
 * @param port The port the bridge listens on.
 * @returns A context that connects on demand.
 */
export function createContext(port: number): LazyContext {
	const url = `ws://127.0.0.1:${port}?${CONTROLLER_ENDPOINT_MARKER}`;

	let client: ControllerClient | undefined;

	return {
		get client(): ControllerClient {
			if (client) return client;

			client = new ControllerClient(url);
			client.connect();

			return client;
		},
		get connected(): boolean {
			return client !== void 0;
		},
		close() {
			client?.close();
		},
	};
}

/**
 * @description Waits for the bridge to report a connected device, for one-shot commands that dial in,
 * run, and exit. Resolves early once a device is seen; resolves `false` once the timeout elapses so
 * the caller can surface a connection error rather than hang.
 * @param client The controller dialing the bridge.
 * @param timeoutMs How long to wait before giving up.
 * @returns Whether a device connected within the timeout.
 */
export function waitForDevice(
	client: ControllerClient,
	timeoutMs: number = DEVICE_WAIT_TIMEOUT_MS,
): Promise<boolean> {
	return new Promise((resolve) => {
		if (client.isDeviceConnected) return resolve(true);

		const deadline = Date.now() + timeoutMs;

		const timer = setInterval(() => {
			if (client.isDeviceConnected) {
				clearInterval(timer);
				resolve(true);
			} else if (Date.now() >= deadline) {
				clearInterval(timer);
				resolve(false);
			}
		}, DEVICE_WAIT_POLL_MS);
	});
}

export default createContext;
