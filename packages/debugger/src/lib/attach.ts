import { ControllerClient } from '@unbound-app/debugger-protocol/controller';
import { CONTROLLER_ENDPOINT_MARKER } from '@unbound-app/debugger-protocol';
import { isListening } from '@unbound-app/debugger-protocol/is-listening';

import {
	abortCurrentReplInput,
	setupReplListeners,
	state as replState,
	takeReplInput,
} from './repl';
import { describeDevice, printLog, system } from './output';

/**
 * @description Runs the REPL against a bridge another process hosts (DevTools, another terminal or a
 * background `ubd` bridge), as a controller. Once no bridge listens on the port, it calls `onBridgeGone`
 * so this process can host one itself.
 * @param port The port the other bridge listens on.
 * @param onBridgeGone Called once, after the client is closed, when the port is free.
 */
export function attachToBridge(port: number, onBridgeGone: () => void) {
	let deviceConnected = false;

	const client: ControllerClient = new ControllerClient(
		`ws://127.0.0.1:${port}?${CONTROLLER_ENDPOINT_MARKER}`,
		{
			// Runs before every redial: a free port means the bridge is gone rather than restarting.
			beforeConnect: async () => {
				if (await isListening(port)) return;

				client.close();
				onBridgeGone();
			},
			onConnection(open) {
				abortCurrentReplInput({ deletePrompt: true });

				if (open) {
					system('gray', `Attached to the bridge already running on port ${port}`);

					return;
				}

				deviceConnected = false;
				system('red', `Lost the bridge on port ${port}`);
			},
			onDeviceStatus(connected, device) {
				abortCurrentReplInput({ deletePrompt: true });

				if (!connected) {
					if (deviceConnected) {
						system('red', 'Device disconnected');
					}

					deviceConnected = false;

					return;
				}

				if (!deviceConnected) {
					system('green', 'Device connected');
				}

				if (device) {
					system('green', `Device identified: ${describeDevice(device)}`);
				}

				deviceConnected = true;
				setupReplListeners();
				takeReplInput();
			},
			onLog(log) {
				abortCurrentReplInput({ deletePrompt: true });
				printLog(log);

				if (deviceConnected) {
					takeReplInput();
				}
			},
		},
	);

	replState.evaluate = (code) => client.evaluate(code);
	client.connect();
}

export default attachToBridge;
