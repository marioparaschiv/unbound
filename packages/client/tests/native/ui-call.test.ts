import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

type CallResult = { ok: true; value: number } | { ok: false; error: string };
type Completion = (result: CallResult) => void;
type CallClosure = { settle: Completion };
type Scheduled = () => void;

const completions: Completion[] = [];
const scheduled: Scheduled[] = [];
let schedulingFailure: Error | undefined;

mockLookups({
	findByProps: () => ({
		runOnJS: (callback: Completion) => callback,
		runOnUI: (worklet: () => void) => () => {
			if (schedulingFailure) {
				throw schedulingFailure;
			}

			const closure: CallClosure = Reflect.get(worklet, '__closure');

			scheduled.push(worklet);
			completions.push(closure.settle);
		},
	}),
});

const { createScopedUIBridge } = await import('~/native/ui');

beforeEach(() => {
	Reflect.set(globalThis, '_REANIMATED_VERSION_JS', '3.19.4');
	Reflect.set(globalThis, '_REANIMATED_VERSION_CPP', '3.19.4');
});

afterEach(() => {
	completions.length = 0;
	scheduled.length = 0;
	schedulingFailure = undefined;
	jest.useRealTimers();
	jest.restoreAllMocks();

	for (const name of [
		'_REANIMATED_VERSION_JS',
		'_REANIMATED_VERSION_CPP',
		'_WORKLETS_VERSION_JS',
		'_WORKLETS_VERSION_CPP',
	]) {
		Reflect.deleteProperty(globalThis, name);
	}
});

function evalWorkletCode(worklet: Scheduled | undefined) {
	const initData: { code: string } | undefined = worklet && Reflect.get(worklet, '__initData');

	// oxlint-disable-next-line no-eval -- mirrors the UI runtime's own unpacker.
	return (0, eval)(initData?.code ?? '') as
		| ((this: Scheduled, value: number) => void)
		| undefined;
}

function useReanimated4(worklets = '0.14.0-main') {
	Reflect.set(globalThis, '_REANIMATED_VERSION_JS', '4.8.0-main');
	Reflect.set(globalThis, '_REANIMATED_VERSION_CPP', '4.8.0-main');
	Reflect.set(globalThis, '_WORKLETS_VERSION_JS', worklets);
	Reflect.set(globalThis, '_WORKLETS_VERSION_CPP', worklets);
}

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

	test('runs on Reanimated 4 with the react-native-worklets version it was verified on', async () => {
		useReanimated4();
		const { bridge, dispose } = createScopedUIBridge([], 'android');
		const pending = bridge.call(() => 42);

		completions[0]?.({ ok: true, value: 42 });
		expect(await pending).toBe(42);
		dispose();
	});

	test('refuses Reanimated 4 on another or a mismatched worklets runtime', () => {
		useReanimated4('0.15.0');
		const { bridge, dispose } = createScopedUIBridge([], 'android');

		expect(() => bridge.run(() => {})).toThrow('worklets runtime version is unsupported');
		Reflect.set(globalThis, '_WORKLETS_VERSION_JS', '0.14.0-main');
		expect(() => bridge.run(() => {})).toThrow('native 0.15.0');
		Reflect.deleteProperty(globalThis, '_WORKLETS_VERSION_CPP');
		expect(() => bridge.callback(() => {})).toThrow('unsupported');
		expect(completions).toHaveLength(0);
		dispose();
	});

	test('guard code evaluates to a function as is, as react-native-worklets evals it', () => {
		const { bridge, dispose } = createScopedUIBridge([], 'android');
		const ran: number[] = [];

		bridge.run((value: number) => ran.push(value), 1);
		void bridge.call(() => 2).catch(() => undefined);

		expect(scheduled).toHaveLength(2);

		for (const worklet of scheduled) {
			expect(typeof evalWorkletCode(worklet)).toBe('function');
		}

		const [guardedRun] = scheduled;

		if (guardedRun) {
			evalWorkletCode(guardedRun)?.call(guardedRun, 3);
		}

		expect(ran).toEqual([3]);
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
