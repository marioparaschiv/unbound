import { describe, expect, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

type Listener = (...values: number[]) => void;

type CallbackClosure = {
	runOnJS: (listener: Listener) => Listener;
	listener: Listener;
};

mockLookups({
	findByProps: () => ({
		runOnJS: (listener: Listener) => listener,
		runOnUI: () => () => undefined,
	}),
});

const { createScopedUIBridge } = await import('~/native/ui');

function callFromUIRuntime(callback: Listener, values: number[]) {
	const closure: CallbackClosure = Reflect.get(callback, '__closure');

	closure.runOnJS(closure.listener)(...values);
}

describe('UI callbacks', () => {
	test('hand values from a worklet to the JS listener until the plugin stops', () => {
		Reflect.set(globalThis, '_REANIMATED_VERSION_JS', '3.19.4');
		Reflect.set(globalThis, '_REANIMATED_VERSION_CPP', '3.19.4');
		const heard: number[][] = [];
		const { bridge, dispose } = createScopedUIBridge([], 'android');
		const callback = bridge.callback((...values: number[]) => heard.push(values));

		callFromUIRuntime(callback, [1, 2]);
		expect(heard).toEqual([[1, 2]]);

		dispose();
		callFromUIRuntime(callback, [3]);
		expect(heard).toEqual([[1, 2]]);
		Reflect.deleteProperty(globalThis, '_REANIMATED_VERSION_JS');
		Reflect.deleteProperty(globalThis, '_REANIMATED_VERSION_CPP');
	});
});
