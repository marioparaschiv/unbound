import { createLogger } from '@unbound-app/logger';
import { createPatcher } from 'possess';

import storage from '~/api/storage';

const Patcher = createPatcher('Debugger');
const Logger = createLogger('Debugger');
const Settings = storage.getStore('unbound');

let ws: WebSocket | null = null;
let appStateSubscription: { remove: () => void } | null = null;

const listeners = new Set<(payload: any) => void>();

export function start(isReconnect = false) {
	const enabled = Settings.get('debugger.enabled', false);
	if (!enabled) return;

	const address = Settings.get<string | null>('debugger.address', null);

	if (!address) {
		Logger.warn('Debugger address not configured');
		return;
	}

	patchLoggingHook();

	ws = new WebSocket(`ws://${address}`);

	ws.addEventListener('open', () => {
		Logger.success(isReconnect ? 'Reconnected' : 'Connected');
	});

	ws.addEventListener('close', ({ code }) => {
		Logger.warn(`Socket closed with code ${code}`);
		stop();
	});

	ws.addEventListener('message', (message) => {
		try {
			// oxlint-disable-next-line no-eval
			const result = eval(message.data);
			console.log(result);
		} catch (e) {
			console.error(e);
		}
	});

	attachAppStateListener();
	attachSettingsListener();
}

export function stop() {
	Patcher.unpatchAll();

	if (ws?.readyState === WebSocket.OPEN) {
		ws.close();
		ws = null;
	}

	if (appStateSubscription) {
		appStateSubscription.remove();
		appStateSubscription = null;
	}

	for (const listener of listeners) {
		storage.removeListener(listener);
	}

	listeners.clear();
}

function patchLoggingHook() {
	Patcher.before(globalThis, 'nativeLoggingHook', ({ args }) => {
		const [message, level] = args;

		if (ws?.readyState === WebSocket.OPEN) {
			try {
				ws.send(JSON.stringify({ level, message }));
			} catch (error) {
				Logger.error('Failed to send log:', error);
			}
		}

		return args;
	});
}

function attachAppStateListener() {
	const { AppState } = globalThis.ReactNative;

	appStateSubscription = AppState.addEventListener('change', (state: string) => {
		switch (state) {
			case 'active':
				if (ws?.readyState === WebSocket.OPEN) return;
				start(true);
				break;
			case 'background':
				stop();
				break;
		}
	});
}

function attachSettingsListener() {
	const handler = (payload: any) => {
		if (!payload.key?.startsWith('debugger.')) return;

		if (payload.key === 'debugger.enabled') {
			if (payload.value) {
				start();
			} else {
				stop();
			}
		} else if (payload.key === 'debugger.address') {
			if (ws?.readyState === WebSocket.OPEN) {
				Logger.info('Address changed, reconnecting...');
				stop();
				start(true);
			}
		}
	};

	storage.on('changed', handler);
	listeners.add(handler);
}

export default { start, stop };
