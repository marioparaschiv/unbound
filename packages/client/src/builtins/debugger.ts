import { createLogger } from '@unbound-app/logger';
import { createPatcher } from 'possess';

import storage, { type SettingsPayload } from '~/api/storage';

// TEMP: forced on with a hardcoded address until the settings UI is ported. Edit this to point the
// debugger at your machine.
const DEBUGGER_ADDRESS = '192.168.0.135:9090';

const Patcher = createPatcher('Debugger');
const Logger = createLogger('Debugger');

let ws: WebSocket | null = null;
let sending = false;
let appStateSubscription: { remove: () => void } | null = null;

const listeners = new Set<(payload: any) => void>();

export function start() {
	patchLoggingHook();
	attachAppStateListener();
	attachSettingsListener();

	// The socket only carries data reliably once the app is interactive, so connect on AppState
	// `active`. Attempt once now too, in case the app is already active and won't fire a transition.
	connect();
}

function connect(isReconnect = false) {
	// Already connected or a connection is in flight.
	if (ws) return;

	ws = new WebSocket(`ws://${DEBUGGER_ADDRESS}`);

	ws.addEventListener('open', () => {
		Logger.success(isReconnect ? 'Reconnected' : 'Connected');
	});

	ws.addEventListener('error', (event: any) => {
		Logger.error('Socket error:', event?.message ?? event);
	});

	ws.addEventListener('close', ({ code }) => {
		Logger.warn(`Socket closed with code ${code}`);
		ws = null;
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
}

export function stop() {
	Patcher.unpatchAll();

	if (ws) {
		if (ws.readyState === WebSocket.OPEN) ws.close();
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

export function shouldStart() {
	// TEMP: forced on until the settings UI is ported. Was: Settings.get('debugger.enabled', false).
	return true;
}

function patchLoggingHook() {
	Patcher.before(globalThis, 'nativeLoggingHook', ({ args }) => {
		const [message, level] = args;

		// Re-entrancy guard: `ws.send` failing (or any logging below) would route back through
		// `nativeLoggingHook` and recurse. Bail if we are already inside a send.
		if (ws?.readyState === WebSocket.OPEN && !sending) {
			sending = true;
			try {
				ws.send(JSON.stringify({ level, message }));
			} catch {
				// Swallow: logging the failure here would re-enter this hook and loop.
			} finally {
				sending = false;
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
				connect(true);
				break;
			case 'background':
				if (ws?.readyState === WebSocket.OPEN) ws.close();
				break;
		}
	});
}

function attachSettingsListener() {
	const handler = (payload: SettingsPayload) => {
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
				ws.close();
				connect(true);
			}
		}
	};

	storage.on('changed', handler);
	listeners.add(handler);
}

export default { start, stop, shouldStart };
