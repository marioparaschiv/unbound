import { afterEach, describe, expect, mock, test } from 'bun:test';

let loaded: ((mdl: MetroExport) => void) | null = null;

mock.module('@unbound-app/logger', () => ({
	createLogger: () => ({ info: () => undefined, warn: () => undefined }),
}));

mock.module('~/metro/filters', () => ({ byProps: () => () => true }));
mock.module('~/metro/wait', () => ({
	onModuleLoaded: (_filter: () => boolean, callback: (mdl: MetroExport) => void) => {
		loaded = callback;

		return () => void (loaded = null);
	},
}));

const { start, stop } = await import('~/builtins/fast-connect-guard');

function loadFastConnect(open: boolean) {
	const calls: string[] = [];
	const FastConnect = {
		identifyWebSocket: () => void calls.push('identify'),
		closeFastConnectSocket: () => void calls.push('close'),
	};

	globalThis._ws = { state: { open } };
	start();
	loaded?.(FastConnect);

	return { FastConnect, calls };
}

afterEach(() => {
	stop();
	loaded = null;
	globalThis._ws = undefined;
});

describe('fast connect guard', () => {
	test('identifies on a socket that has not opened yet', () => {
		const { FastConnect, calls } = loadFastConnect(false);

		FastConnect.identifyWebSocket();

		expect(calls).toEqual(['identify']);
	});

	test('drops a socket that opened before Discord could identify on it', () => {
		const { FastConnect, calls } = loadFastConnect(true);

		FastConnect.identifyWebSocket();

		expect(calls).toEqual(['close']);
	});

	test('restores Discord’s identify when stopped', () => {
		const { FastConnect, calls } = loadFastConnect(true);

		stop();
		FastConnect.identifyWebSocket();

		expect(calls).toEqual(['identify']);
	});
});
