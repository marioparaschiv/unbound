import type { BuiltInData } from '@typings/built-ins';
import { createLogger } from '@structures/logger';
import { createPatcher } from '@api/patcher';
import { getStore } from '@api/storage';
import { AppState } from 'react-native';

const Patcher = createPatcher('unbound::badges');
const Logger = createLogger('Core', 'Debug Bridge');
const Settings = getStore('unbound');

export let ws: WebSocket;

export const data: BuiltInData = {
	name: 'Debug Bridge',
	shouldInitialize: () => Settings.get('debug-bridge.enabled', false),
	settings: {
		monitor: [
			'debug-bridge.enabled',
			'debug-bridge.address',
		],
	},
};

export function start(isReconnect = false) {
	const address = Settings.get('debug-bridge.address', '192.168.0.35:9090');
	if (!address) return Logger.warn('Address is invalid.');

	patchLoggingHook();

	ws = new WebSocket(`ws://${address}`);

	ws.addEventListener('open', () => {
		Logger.success(isReconnect ? 'Reconnected.' : 'Connected.');
	});

	ws.addEventListener('close', ({ code }) => {
		Logger.warn(`Socket closed with code ${code}.`);
		stop();
	});

	ws.addEventListener('message', message => {
		try {
			const result = eval(message.data);
			console.log(result);
		} catch (e) {
			console.error(e);
		}
	});

	attachAppStateListener();
}

export function stop() {
	Patcher.unpatchAll();

	if (ws?.readyState === ws.OPEN) {
		ws.close();
		ws = null;
	}
}

function patchLoggingHook() {
	Patcher.before(globalThis, 'nativeLoggingHook', (_, args) => {
		const [message, level] = args;

		if (ws?.readyState === WebSocket.OPEN) {
			try {
				ws.send(JSON.stringify({ level, message }));
			} catch (error) {
				Logger.error('Failed to send log message:', error);
			}
		}

		return args;
	});
}

function attachAppStateListener() {
	const { remove } = AppState.addEventListener('change', (state) => {
		switch (state) {
			case 'active':
				if (ws || ws?.readyState === WebSocket.OPEN) return;

				remove();
				start(true);
				break;
			case 'background':
				stop();
				break;
		}
	});
}