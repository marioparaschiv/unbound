import type { DiscoveredBridge } from '~/debugger/bridge-service.dev';
import { showDialog, type DialogHandle } from '~/dialogs/api';
import { getSetting, setSetting } from '~/settings/unbound';

/**
 * @description Whether the user chose "Always for this computer" for a bridge's computer.
 * @param bridge The discovered bridge.
 * @returns `true` when the device connects to it without asking.
 */
export function isTrusted(bridge: DiscoveredBridge): boolean {
	return getSetting('debugger.trusted').includes(bridge.computer);
}

/**
 * @description Asks whether to connect to a bridge found on the network, showing its pairing code to compare with
 * the one the computer shows.
 * @param bridge The discovered bridge.
 * @param connect Runs when the user chooses to connect.
 * @param decline Runs when the user says not now, or dismisses the prompt.
 * @returns The open prompt.
 */
export function promptToConnect(
	bridge: DiscoveredBridge,
	connect: () => void,
	decline: () => void,
): DialogHandle {
	const tool = bridge.by === 'cli' ? 'The Unbound CLI is running' : 'Unbound DevTools is open';

	return showDialog({
		title: 'Connect to debugger?',
		body: `${tool} on ${bridge.computer}. Connect?\n\nPairing code: ${bridge.code}\nCheck that your computer shows the same code.`,
		buttons: [
			{ label: 'Connect', onPress: connect },
			{
				label: 'Always for this computer',
				variant: 'secondary',
				onPress: () => {
					setSetting('debugger.trusted', [
						...getSetting('debugger.trusted'),
						bridge.computer,
					]);
					connect();
				},
			},
		],
		cancel: 'Not now',
		onCancel: decline,
		onDismiss: decline,
	});
}
