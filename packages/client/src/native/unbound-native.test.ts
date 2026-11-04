import { afterEach, describe, expect, test } from 'bun:test';
import sha256 from '@unbound-app/utils/sha256';

import { getAvailableFonts, getFonts, getLoader, getPlugins, getSha256 } from './unbound-native';

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
			getSha256: () => 'native',
			downloadFile: async () => undefined,
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
			getSha256: () => {
				throw new Error('native failure');
			},
			downloadFile: async () => undefined,
		};

		expect(getLoader()).toBeUndefined();
		expect(getPlugins()).toEqual([]);
		expect(getSha256('abc')).toBe(sha256('abc'));
	});

	test('hashes natively when the loader can, in JS otherwise', () => {
		expect(getSha256('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
		);

		globalThis.UnboundNative = {
			getLoader: () => ({ origin: 'test', version: '2.0.0', bytecodeVersion: 96 }),
			getPlugins: () => [],
			getThemes: () => [],
			getFonts: () => [],
			getAvailableFonts: () => [],
			getSha256: (text) => `native:${text}`,
			downloadFile: async () => undefined,
		};

		expect(getSha256('abc')).toBe('native:abc');
	});
});
