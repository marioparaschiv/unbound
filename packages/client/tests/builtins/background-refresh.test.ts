import { describe, expect, mock, test } from 'bun:test';

const calls: string[] = [];
const errors: string[] = [];
let handler: (() => Promise<void>) | undefined;
let syncEnabled = true;

mock.module('@unbound-app/logger', () => ({
	createLogger: () => ({ error: (message: string) => void errors.push(message) }),
}));

mock.module('~/native/unbound-native', () => ({
	setBackgroundRefresh: (next?: () => Promise<void>) => void (handler = next),
}));

mock.module('~/storage/api', () => ({
	persist: async () => void calls.push('settings'),
}));

mock.module('~/updates/update-in-background', () => ({
	updateInBackground: async () => {
		throw new Error('offline');
	},
}));

mock.module('~/sync/api', () => ({
	isEnabled: () => syncEnabled,
	now: async () => void calls.push('sync'),
}));

mock.module('~/diagnostics/crash-reports', () => ({
	retryPendingIssues: async () => void calls.push('crash issues'),
}));

mock.module('~/marketplace/state', () => ({
	default: { getState: () => ({ load: async () => void calls.push('catalog') }) },
}));

const { afterAddons, stop } = await import('~/builtins/background-refresh');

describe('background refresh', () => {
	test('saves settings first and runs every job when one fails', async () => {
		afterAddons();
		await handler?.();

		expect(calls[0]).toBe('settings');
		expect(calls.slice(1).sort()).toEqual(['catalog', 'crash issues', 'sync']);
		expect(errors).toEqual(['Failed to run background job addon updates:']);
	});

	test('skips sync while it is off', async () => {
		calls.length = 0;
		syncEnabled = false;
		await handler?.();

		expect(calls).not.toContain('sync');
	});

	test('stop clears the handler', () => {
		stop();

		expect(handler).toBeUndefined();
	});
});
