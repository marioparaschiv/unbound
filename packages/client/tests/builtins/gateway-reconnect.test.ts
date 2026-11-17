import { afterEach, describe, expect, mock, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

type AppStateAction = { state: string };

type Listener = (action: AppStateAction) => void;

let listener: Listener | null = null;
let interceptor: Listener | null = null;
let authenticated = true;
const calls: string[] = [];

const socket = {
	connectionState: 'CLOSED',
	connectionStartTime: 0,
	isClosed: () => socket.connectionState === 'CLOSED',
	connect: () => void calls.push('connect'),
	resetBackoff: () => void calls.push('reset backoff'),
};

const appState = { currentState: 'active' };

mock.module('@unbound-app/logger', () => ({
	createLogger: () => ({ info: () => undefined }),
}));

mock.module('react-native', () => ({ AppState: appState }));

mock.module('~/flux/api', () => ({
	getStore: (name: string) =>
		name === 'GatewayConnection'
			? { getSocket: () => socket }
			: { isAuthenticated: () => authenticated },
	interceptAction: (_type: string, callback: Listener) => {
		interceptor = callback;

		return () => void (interceptor = null);
	},
	onAction: (_type: string, callback: Listener) => {
		listener = callback;

		return () => void (listener = null);
	},
}));

mockLookups({
	findByProps: () => ({ setIsPaused: (paused: boolean) => void calls.push(`paused ${paused}`) }),
});

const { start, stop } = await import('~/builtins/gateway-reconnect');

// Delivers an app state change the way Discord's dispatcher does: interceptors, Discord's stores, then listeners.
function dispatch(state: string, discordHandler?: () => void) {
	interceptor?.({ state });
	discordHandler?.();
	listener?.({ state });
}

afterEach(() => {
	stop();
	socket.connectionState = 'CLOSED';
	socket.connectionStartTime = 0;
	appState.currentState = 'active';
	authenticated = true;
	calls.length = 0;
});

describe('gateway reconnect', () => {
	test('unpauses and connects a closed socket when Discord becomes active', () => {
		start();
		dispatch('active');

		expect(calls).toEqual(['paused false', 'connect']);
	});

	test('leaves an established socket alone', () => {
		socket.connectionState = 'SESSION_ESTABLISHED';
		start();
		dispatch('background');
		dispatch('active');

		expect(calls).toEqual([]);
	});

	test('restarts an attempt begun in a prewarmed launch as soon as Discord comes to the front', () => {
		appState.currentState = 'background';
		socket.connectionState = 'CONNECTING';
		socket.connectionStartTime = Date.now() - 1000;
		start();
		dispatch('active');

		expect(calls).toEqual(['paused false', 'reset backoff']);
	});

	test('restarts a retry waiting out its backoff after a return through inactive', () => {
		socket.connectionState = 'WILL_RECONNECT';
		socket.connectionStartTime = Date.now() - 1000;
		start();
		dispatch('background');
		dispatch('inactive');
		dispatch('active');

		expect(calls).toEqual(['paused false', 'reset backoff']);
	});

	test('keeps the attempt Discord starts on its own return to the front', () => {
		socket.connectionState = 'CLOSED';
		start();
		dispatch('background');
		dispatch('active', () => {
			socket.connectionState = 'CONNECTING';
			socket.connectionStartTime = Date.now();
		});

		expect(calls).toEqual([]);
	});

	test('leaves an attempt alone when Discord never left the front', () => {
		socket.connectionState = 'CONNECTING';
		start();
		dispatch('inactive');
		dispatch('active');

		expect(calls).toEqual([]);
	});

	test('ignores other app states and a signed-out user', () => {
		start();
		dispatch('background');
		authenticated = false;
		dispatch('active');

		expect(calls).toEqual([]);
	});

	test('stops listening once stopped', () => {
		start();
		stop();

		expect(listener).toBeNull();
		expect(interceptor).toBeNull();
	});
});
