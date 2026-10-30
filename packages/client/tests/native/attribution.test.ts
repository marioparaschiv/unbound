import { afterEach, describe, expect, test } from 'bun:test';

import {
	createPluginContext,
	withNativeConstants,
	nativeHandle,
	bridge,
	manifest,
	nativePlatformBridge,
	resetNativeFixtures,
} from '../helpers/native-bridge';

afterEach(resetNativeFixtures);

describe('native crash attribution', () => {
	test('marks the plugin active while its scoped native calls run', async () => {
		const { attributeAddon, resetCrashGuard } = await import('~/api/crash-guard');
		const buffer = new ArrayBuffer(4);
		const cell = new Uint32Array(buffer);
		const observed: number[] = [];
		const registered: string[][] = [];

		resetCrashGuard();
		Object.assign(nativePlatformBridge, {
			crashGuard: {
				begin: () => true,
				end: () => true,
				disabled: () => [],
				register: (id: string, name: string) => (registered.push([id, name]), 7),
				activity: () => buffer,
			},
		});
		Object.assign(bridge, {
			ffi: {
				call: () => {
					observed.push(cell[0]);
					throw new Error('call failed');
				},
				symbol: () => (observed.push(cell[0]), null),
			},
		});

		try {
			const context = createPluginContext(
				{ ...manifest, capabilities: ['native.ffi.symbols', 'native.ffi.call'] },
				attributeAddon('plugins:test', 'test'),
			);

			expect(context.native.ffi.symbol('getpid')).toBeNull();
			expect(cell[0]).toBe(0);
			expect(() =>
				context.native.ffi.call(nativeHandle, { returnType: 'void', args: [] }),
			).toThrow('call failed');
			expect(cell[0]).toBe(0);
			expect(observed).toEqual([7, 7]);
			expect(registered).toEqual([['plugins:test', 'test']]);
		} finally {
			Reflect.deleteProperty(nativePlatformBridge, 'crashGuard');
			resetCrashGuard();
		}
	});
});

type ClientInfoConstants = { Version?: string; Build?: string };

type ClientInfoModule = ClientInfoConstants & { getConstants: () => ClientInfoConstants };

describe('withNativeConstants', () => {
	test('reads an Android TurboModule constants as properties', () => {
		const module = { getConstants: () => ({ Version: '352.10', Build: '352110' }) };

		expect(withNativeConstants<ClientInfoModule>(module)).toMatchObject({
			Version: '352.10',
			Build: '352110',
		});
	});

	test('leaves an iOS module with direct properties as it is', () => {
		const module = { Version: '351.0', Build: '118370' };

		expect(withNativeConstants(module)).toBe(module);
		expect(withNativeConstants(undefined)).toBeUndefined();
	});
});
