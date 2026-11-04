import { afterEach, describe, expect, test } from 'bun:test';

import { getAvailableFonts, getFonts, getLoader, getPlugins } from './unbound-native';

afterEach(() => {
	globalThis.UnboundNative = undefined;
});

describe('UnboundNative', () => {
	test('reads nothing without a loader', () => {
		expect(getLoader()).toBeUndefined();
		expect(getPlugins()).toEqual([]);
		expect(getAvailableFonts()).toEqual([]);
	});

	test('reads the bridge installed after import', () => {
		globalThis.UnboundNative = {
			getLoader: () => ({ origin: 'test', version: '2.0.0', bytecodeVersion: 96 }),
			getPlugins: () => [],
			getThemes: () => [],
			getFonts: () => [{ name: 'Inter', file: 'Inter.ttf', path: '/Fonts/Inter.ttf' }],
			getAvailableFonts: () => ['System'],
		};

		expect(getLoader()?.bytecodeVersion).toBe(96);
		expect(getFonts()[0]?.name).toBe('Inter');
		expect(getAvailableFonts()).toEqual(['System']);
	});

	test('a throwing getter reads as empty', () => {
		globalThis.UnboundNative = {
			getLoader: () => {
				throw new Error('native failure');
			},
			getPlugins: () => {
				throw new Error('native failure');
			},
			getThemes: () => [],
			getFonts: () => [],
			getAvailableFonts: () => [],
		};

		expect(getLoader()).toBeUndefined();
		expect(getPlugins()).toEqual([]);
	});
});
