import { describe, expect, mock, test } from 'bun:test';

const calls: string[] = [];
const errors: string[] = [];
let handler: (() => Promise<void>) | undefined;

mock.module('@unbound-app/logger', () => ({
	createLogger: () => ({ error: (message: string) => void errors.push(message) }),
}));

mock.module('~/native/unbound-native', () => ({
	setBackgroundRefresh: (next?: () => Promise<void>) => void (handler = next),
	warmAddonDigests: async () => void calls.push('digests'),
	removeOrphanedAddons: async () => void calls.push('orphans'),
}));

mock.module('~/account/api', () => ({
	refresh: async () => void calls.push('session'),
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
	isEnabled: () => true,
	now: async () => void calls.push('sync'),
}));

mock.module('~/diagnostics/crash-reports', () => ({
	retryPendingIssues: async () => void calls.push('crash issues'),
}));

mock.module('~/marketplace/state', () => ({
	default: { getState: () => ({ load: async () => void calls.push('catalog') }) },
}));

const { afterAddons, stop } = await import('~/builtins/background-refresh');
const { backgroundJobs } = await import('~/background/jobs');

describe('background refresh', () => {
	test('saves settings and the session first, upkeep last, and logs a failed job', async () => {
		afterAddons();
		await handler?.();

		expect(calls.slice(0, 2).sort()).toEqual(['session', 'settings']);
		expect(calls.slice(-2).sort()).toEqual(['digests', 'orphans']);
		expect(calls.slice(2, -2).sort()).toEqual(['catalog', 'crash issues', 'sync']);
		expect(errors).toEqual(['Failed to run background job addon updates (unbound):']);
	});

	test('stop clears the handler and the built-in jobs', () => {
		stop();

		expect(handler).toBeUndefined();
		expect(backgroundJobs()).toEqual([]);
	});
});
