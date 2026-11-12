import { describe, expect, mock, test } from 'bun:test';

let listener: ((state: string) => void) | undefined;

mock.module('react-native', () => ({
	AppState: {
		addEventListener: (_: string, next: (state: string) => void) => {
			listener = next;

			return { remove: () => (listener = undefined) };
		},
	},
}));

const { readAppSession, startAppSession, stopAppSession } =
	await import('~/diagnostics/app-session');

describe('app session', () => {
	test('counts trips to the background until stopped', () => {
		startAppSession();
		listener?.('background');
		listener?.('active');
		listener?.('background');

		expect(readAppSession()).toMatchObject({ backgrounded: 2 });

		stopAppSession();

		expect(listener).toBeUndefined();
		expect(readAppSession().uptimeS).toBeGreaterThanOrEqual(0);
	});
});
