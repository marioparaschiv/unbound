import { afterEach, describe, expect, jest, mock, spyOn, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

type Scheduled = { closure: { done?: () => void }; args: unknown[] };

const scheduled: Scheduled[] = [];
let disposed = 0;

mockLookups({
	findByProps: () => ({
		ReanimatedModule: {},
		runOnJS: (callback: () => void) => callback,
		runOnUI:
			(worklet: { __closure: Scheduled['closure'] }) =>
			(...args: unknown[]) => {
				scheduled.push({ closure: worklet.__closure, args });
			},
	}),
});

mock.module('~/native/bridge', () => ({
	getNativeBridge: () => ({
		objc: {
			createUIScope: () => ({
				dispose: () => {
					disposed++;
				},
			}),
		},
	}),
}));

Reflect.set(globalThis, '_REANIMATED_VERSION_JS', '3.19.4');
Reflect.set(globalThis, '_REANIMATED_VERSION_CPP', '3.19.4');

const { createScopedUIBridge } = await import('~/native/ui');

afterEach(() => {
	scheduled.length = 0;
	disposed = 0;
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe('disposing UI scopes', () => {
	test('queues the disposal on the UI runtime behind the work already queued', () => {
		jest.useFakeTimers();
		const { bridge, dispose } = createScopedUIBridge([], 'ios', 'unbound.example');

		bridge.createScope();
		dispose();

		expect(scheduled).toHaveLength(1);
		expect(disposed).toBe(0);
		scheduled[0]?.closure.done?.();
		jest.advanceTimersByTime(2000);
		expect(disposed).toBe(0);
	});

	test('disposes from JS and names the plugin when the UI thread never gets to it', () => {
		jest.useFakeTimers();
		const error = spyOn(console, 'error').mockImplementation(() => {});
		const { bridge, dispose } = createScopedUIBridge([], 'ios', 'unbound.example');

		bridge.createScope();
		dispose();
		jest.advanceTimersByTime(2000);

		expect(disposed).toBe(1);
		expect(error.mock.calls.flat().join(' ')).toContain('unbound.example');
	});
});
