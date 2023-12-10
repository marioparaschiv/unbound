import type { BuiltIn } from '@typings/core/builtins';
import { ReactNative } from '@metro/common';
import { getStore } from '@api/storage';
import { createLogger } from '@logger';

const Logger = createLogger('Debug', 'WebSocket');

export const data: BuiltIn['data'] = {
	id: 'dev.debugBridge.enabled',
	settings: ['dev.debugBridge.host'],
	default: false
};

export let ws: WebSocket;
export let connected = false;

export function initialize(isReconnect = false) {
	const settings = getStore('unbound');

	try {
		ws = new WebSocket(`ws://${settings.get('dev.debugBridge.host', '192.168.0.35:9090')}`);
	} catch (e) {
		alert('Failed to connect to the debug websocket. Make sure the host is reachable.');
		Logger.error(e.message);
	}

	ws?.addEventListener('open', () => {
		Logger.success(isReconnect ? 'Reconnected.' : 'Connected.');
		connected = true;
	});

	ws?.addEventListener('close', () => {
		connected = false;
	});

	ws?.addEventListener('message', message => {
		try {
			Logger.log(eval(message.data));
		} catch (e) {
			Logger.error(e);
		}
	});

	globalThis._nativeLoggingHook = nativeLoggingHook;
	globalThis.nativeLoggingHook = function (message: string, level: string) {
		if (ws?.readyState === WebSocket.OPEN && connected) {
			ws.send(JSON.stringify({ level, message }));
		}

		return globalThis._nativeLoggingHook.apply(this, arguments);
	};

	const { remove } = ReactNative.AppState?.addEventListener('change', (state) => {
		switch (state) {
			case 'active':
				if (ws || ws?.readyState === WebSocket.OPEN) {
					return;
				}

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
	if (globalThis._nativeLoggingHook) {
		globalThis.nativeLoggingHook = globalThis._nativeLoggingHook;
	}

	if (ws?.readyState === WebSocket.OPEN) {
		ws.close();
		ws = null;
	}
}