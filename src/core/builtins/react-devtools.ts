import type { BuiltIn } from '@typings/core/builtins';
import { createLogger } from '@structures/logger';
import { getStore } from '@api/storage';
import { AppState } from 'react-native';

const Logger = createLogger('Debug', 'WebSocket');

export const data: BuiltIn['data'] = {
	id: 'dev.debugBridge.enabled',
	settings: ['dev.devTools.enabled', 'dev.devTools.host'],
	default: false
};

export let ws: WebSocket;
export let connected = false;

export function initialize(isReconnect = false) {
	const settings = getStore('unbound');

	try {
		// window.DevTools

	} catch (error) {
		Logger.error(``);
	}
	// try {
	// 	ws = new WebSocket(`ws://${settings.get('dev.debugBridge.host', '192.168.0.35:9090')}`);
	// } catch (e) {
	// 	alert('Failed to connect to the debug websocket. Make sure the host is reachable.');
	// 	Logger.error(e.message);
	// }

	const { remove } = AppState.addEventListener('change', (state) => {
		switch (state) {
			case 'active':
				remove();
				initialize(true);
				break;
			case 'background':
				shutdown();
				break;
		}
	});
}

export function shutdown() {

}