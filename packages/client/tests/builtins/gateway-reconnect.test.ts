import { afterEach, describe, expect, mock, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

type AppStateAction = { state: string };

type Listener = (action: AppStateAction) => void;

let listener: Listener | null = null;
let closed = true;
let authenticated = true;
const calls: string[] = [];

const socket = {
	isClosed: () => closed,
	connect: () => void calls.push('connect'),
};

mock.module('@unbound-app/logger', () => ({
	createLogger: () => ({ info: () => undefined }),
}));

mock.module('~/flux/api', () => ({
	getStore: (name: string) =>
		name === 'GatewayConnection'
			? { getSocket: () => socket }
			: { isAuthenticated: () => authenticated },
	onAction: (_type: string, callback: Listener) => {
		listener = callback;

		return () => void (listener = null);
	},
}));

mockLookups({
	findByProps: () => ({ setIsPaused: (paused: boolean) => void calls.push(`paused ${paused}`) }),
});

const { start, stop } = await import('~/builtins/gateway-reconnect');

afterEach(() => {
	stop();
	closed = true;
	authenticated = true;
	calls.length = 0;
});

describe('gateway reconnect', () => {
	test('unpauses and connects a closed socket when Discord becomes active', () => {
		start();
		listener?.({ state: 'active' });

		expect(calls).toEqual(['paused false', 'connect']);
	});

	test('leaves an open socket alone', () => {
		closed = false;
		start();
		listener?.({ state: 'active' });

		expect(calls).toEqual([]);
	});

	test('ignores other app states and a signed-out user', () => {
		start();
		listener?.({ state: 'background' });
		authenticated = false;
		listener?.({ state: 'active' });

		expect(calls).toEqual([]);
	});

	test('stops listening once stopped', () => {
		start();
		stop();

		expect(listener).toBeNull();
	});
});
