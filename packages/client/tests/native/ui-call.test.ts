import { afterEach, beforeEach, describe, expect, jest, mock, spyOn, test } from 'bun:test';

type CallResult = { ok: true; value: number } | { ok: false; error: string };
type Completion = (result: CallResult) => void;
type CallClosure = { settle: Completion };

const completions: Completion[] = [];
let schedulingFailure: Error | undefined;

mock.module('~/metro/wrappers', () => ({
	findByPropsLazy: () => ({
		runOnJS: (callback: Completion) => callback,
		runOnUI: (worklet: () => void) => () => {
			if (schedulingFailure) {
				throw schedulingFailure;
			}

			const closure: CallClosure = Reflect.get(worklet, '__closure');

			completions.push(closure.settle);
		},
	}),
}));

const { createScopedUIBridge } = await import('~/native/ui');

beforeEach(() => {
	Reflect.set(globalThis, '_REANIMATED_VERSION_JS', '3.19.4');
	Reflect.set(globalThis, '_REANIMATED_VERSION_CPP', '3.19.4');
});

afterEach(() => {
	completions.length = 0;
	schedulingFailure = undefined;
	jest.useRealTimers();
	jest.restoreAllMocks();
	Reflect.deleteProperty(globalThis, '_REANIMATED_VERSION_JS');
	Reflect.deleteProperty(globalThis, '_REANIMATED_VERSION_CPP');
});

describe('UI calls', () => {
	test('refuses an unrecognized worklet runtime before scheduling work', () => {
		Reflect.set(globalThis, '_REANIMATED_VERSION_JS', '4.0.0');
		Reflect.set(globalThis, '_REANIMATED_VERSION_CPP', '4.0.0');
		const { bridge, dispose } = createScopedUIBridge([], 'android');

		expect(() => bridge.run(() => {})).toThrow('unsupported');
		expect(completions).toHaveLength(0);
		dispose();
	});

	test('refuses mismatched JS and native worklet versions', () => {
		Reflect.set(globalThis, '_REANIMATED_VERSION_CPP', '3.18.0');
		const { bridge, dispose } = createScopedUIBridge([], 'ios');

		expect(() => bridge.run(() => {})).toThrow('unsupported');
		expect(completions).toHaveLength(0);
		dispose();
	});

	test('refuses worklets when runtime version metadata is absent', () => {
		Reflect.deleteProperty(globalThis, '_REANIMATED_VERSION_JS');
		const { bridge, dispose } = createScopedUIBridge([], 'android');

		expect(() => bridge.callback(() => {})).toThrow('unsupported');
		expect(completions).toHaveLength(0);
		dispose();
	});
	test('rejects a cancelled call and ignores a late completion', async () => {
		const { bridge, dispose } = createScopedUIBridge([], 'android');
		const pending = bridge.call(() => 42);
		const rejected = pending.catch((error: Error) => error);

		pending.cancel();
		completions[0]?.({ ok: true, value: 42 });
		expect(await rejected).toMatchObject({ code: 'NATIVE_PLUGIN_CALL_CANCELLED' });
		dispose();
	});

	test('rejects pending calls when the plugin stops', async () => {
		const { bridge, dispose } = createScopedUIBridge([], 'ios');
		const first = bridge.call(() => 1).catch((error: Error) => error);
		const second = bridge.call(() => 2).catch((error: Error) => error);

		dispose();
		dispose();
		completions[0]?.({ ok: true, value: 1 });
		completions[1]?.({ ok: true, value: 2 });
		expect(await first).toMatchObject({ code: 'NATIVE_PLUGIN_SCOPE_DISPOSED' });
		expect(await second).toMatchObject({ code: 'NATIVE_PLUGIN_SCOPE_DISPOSED' });
		expect(() => bridge.call(() => 3)).toThrow('disposed');
	});

	test('times out after five seconds and ignores the late result', async () => {
		jest.useFakeTimers();
		const { bridge, dispose } = createScopedUIBridge([], 'android');
		const pending = bridge.call(() => 42);
		const rejected = pending.catch((error: Error) => error);
		let finished = false;

		void rejected.then(() => {
			finished = true;
		});
		jest.advanceTimersByTime(4999);
		await Promise.resolve();
		expect(finished).toBe(false);
		jest.advanceTimersByTime(1);
		expect(await rejected).toMatchObject({ code: 'NATIVE_PLUGIN_CALL_TIMEOUT' });
		completions[0]?.({ ok: true, value: 42 });
		dispose();
	});

	test('preserves the result after a call completes', async () => {
		const { bridge, dispose } = createScopedUIBridge([], 'ios');
		const pending = bridge.call(() => 42);

		completions[0]?.({ ok: true, value: 42 });
		pending.cancel();
		dispose();
		expect(await pending).toBe(42);
	});

	test('propagates worklet errors', async () => {
		const { bridge, dispose } = createScopedUIBridge([], 'android');
		const pending = bridge.call(() => 42);
		const rejected = pending.catch((error: Error) => error);

		completions[0]?.({ ok: false, error: 'Worklet failed' });
		expect(await rejected).toMatchObject({ message: 'Worklet failed' });
		dispose();
	});

	test('rejects scheduling failures without leaving a pending timeout', async () => {
		jest.useFakeTimers();
		const clear = spyOn(globalThis, 'clearTimeout');

		schedulingFailure = new Error('UI runtime unavailable');
		const { bridge, dispose } = createScopedUIBridge([], 'android');
		const pending = bridge.call(() => 42);

		const failure = await pending.catch((error: Error) => error);

		expect(failure).toMatchObject({ message: 'UI runtime unavailable' });
		expect(clear).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(5000);
		dispose();
	});

	test.each(['success', 'failure', 'cancel', 'dispose'] as const)(
		'clears the timeout after %s',
		async (outcome) => {
			jest.useFakeTimers();
			const clear = spyOn(globalThis, 'clearTimeout');
			const { bridge, dispose } = createScopedUIBridge([], 'android');
			const pending = bridge.call(() => 42);
			const finished = pending.catch((error: Error) => error);

			if (outcome === 'success') {
				completions[0]?.({ ok: true, value: 42 });
			} else if (outcome === 'failure') {
				completions[0]?.({ ok: false, error: 'Worklet failed' });
			} else if (outcome === 'cancel') {
				pending.cancel();
			} else {
				dispose();
			}

			await finished;
			expect(clear).toHaveBeenCalledTimes(1);
			dispose();
		},
	);
});
