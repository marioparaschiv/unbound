import { afterEach, describe, expect, mock, test } from 'bun:test';

import type { SettingsPayload } from '~/storage/api';

type CloseEvent = { code?: number };

type Listener = (event: CloseEvent) => void;

class FakeSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSED = 3;

	readyState = FakeSocket.CONNECTING;
	listeners = new Map<string, Listener[]>();

	constructor(public url: string) {
		sockets.push(this);
	}

	addEventListener(type: string, listener: Listener) {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
	}

	close() {
		this.readyState = FakeSocket.CLOSED;

		for (const listener of this.listeners.get('close') ?? []) listener({ code: 1000 });
	}
}

const sockets: FakeSocket[] = [];
const settings: Record<string, string | boolean> = {
	'debugger.enabled': false,
	'debugger.address': '',
};
let settingsListener: ((payload: SettingsPayload) => void) | undefined;

Object.assign(globalThis, {
	WebSocket: FakeSocket,
	ReactNative: { AppState: { addEventListener: () => ({ remove: () => undefined }) } },
});

const noop = () => undefined;
const logger = { info: noop, success: noop, warn: noop, error: noop };

mock.module('@unbound-app/logger', () => ({ createLogger: () => logger }));
mock.module('~/debugger/view-finder.dev', () => ({
	describeView: noop,
	highlightView: noop,
	listViews: noop,
	resetViewFinder: noop,
}));
mock.module('~/debugger/dev-native.dev', () => ({ installDevNative: noop, removeDevNative: noop }));
mock.module('~/debugger/discovery-prompt.dev', () => ({ isTrusted: noop, promptToConnect: noop }));
mock.module('~/debugger/explorer.dev', () => ({ answerExplorer: noop, resetExplorer: noop }));
mock.module('~/core/constants', () => ({ CLIENT_VERSION: '0.0.0', DEBUGGER_ADDRESS: '' }));
mock.module('~/debugger/react-devtools.dev', () => ({ endSession: noop, receive: noop }));
mock.module('~/settings/unbound', () => ({
	getSetting: (key: string) => settings[key],
	isSettingChange: (payload: SettingsPayload, key: string) => payload.key === key,
}));
mock.module('~/diagnostics/read-debug-info', () => ({ readDebugReport: noop }));
mock.module('~/debugger/metro.dev', () => ({ answerMetro: noop, resetMetro: noop }));
mock.module('~/debugger/reload-summary.dev', () => ({ reloadSummary: noop }));
mock.module('~/debugger/discovery.dev', () => ({ browseBridges: () => noop }));
mock.module('~/patcher/create-patcher', () => ({
	createPatcher: () => ({ before: noop, unpatchAll: noop }),
}));
mock.module('~/core/environment', () => ({ currentEnvironment: noop }));
mock.module('~/native/unbound-native', () => ({ getLoader: noop }));
mock.module('~/plugins/manager', () => ({ plugins: { on: noop, off: noop } }));
mock.module('~/themes/manager', () => ({ themes: { on: noop, off: noop } }));
mock.module('~/toasts/api', () => ({ show: noop }));
mock.module('~/storage/api', () => ({
	onChange: (
		_predicate: (payload: SettingsPayload) => boolean,
		callback: (payload: SettingsPayload) => void,
	) => {
		settingsListener = callback;

		return () => void (settingsListener = undefined);
	},
}));

const { start, stop } = await import('~/debugger/builtin.dev');

function change(key: string, value: string | boolean) {
	settings[key] = value;
	settingsListener?.({ store: 'unbound', key, value });
}

function live() {
	return sockets
		.filter((socket) => socket.readyState !== FakeSocket.CLOSED)
		.map(({ url }) => url);
}

afterEach(() => {
	stop();
	sockets.length = 0;
	settings['debugger.enabled'] = false;
	settings['debugger.address'] = '';
});

describe('debugger builtin', () => {
	test('connects when the switch is turned on after launch, and again after off and on', () => {
		settings['debugger.address'] = 'host:1';
		start();

		expect(live()).toEqual([]);

		change('debugger.enabled', true);
		expect(live()).toEqual(['ws://host:1']);

		change('debugger.enabled', false);
		expect(live()).toEqual([]);

		change('debugger.enabled', true);
		expect(live()).toEqual(['ws://host:1']);
	});

	test('drops a dial in flight and dials the new address at once', () => {
		settings['debugger.enabled'] = true;
		settings['debugger.address'] = 'old:1';
		start();
		change('debugger.address', 'new:2');

		expect(live()).toEqual(['ws://new:2']);
	});

	test('dials nothing when the address changes while the debugger is off', () => {
		start();
		change('debugger.address', 'host:1');

		expect(sockets).toEqual([]);
	});

	test('closes a dial in flight when the debugger is turned off', () => {
		settings['debugger.enabled'] = true;
		settings['debugger.address'] = 'host:1';
		start();
		change('debugger.enabled', false);

		expect(live()).toEqual([]);
	});
});
