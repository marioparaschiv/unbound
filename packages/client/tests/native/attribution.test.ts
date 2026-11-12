import type { NativeBridgeCapability } from '@unbound-app/types';
import { afterEach, describe, expect, test } from 'bun:test';

import {
	NativeBridgeCapabilityError,
	NativeBridgeDisposedError,
	NativeBridgeUnavailableError,
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
		const { attributeAddon, resetCrashGuard } = await import('~/addons/crash-guard');
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

describe('the scoped native call wrapper', () => {
	test('marks the plugin active for prepared calls and calls the loader with its own receiver', async () => {
		const { attributeAddon, resetCrashGuard } = await import('~/addons/crash-guard');
		const buffer = new ArrayBuffer(4);
		const cell = new Uint32Array(buffer);
		const observed: unknown[] = [];
		const objc = bridge.objc;

		resetCrashGuard();
		Object.assign(nativePlatformBridge, {
			crashGuard: {
				begin: () => true,
				end: () => true,
				disabled: () => [],
				register: () => 4,
				activity: () => buffer,
			},
		});
		Object.assign(bridge, {
			objc: {
				...objc,
				invokePrepared(this: typeof objc, ...args: Parameters<typeof objc.invokePrepared>) {
					observed.push(cell[0], this === bridge.objc, args.length);
				},
			},
		});

		try {
			const context = createPluginContext(
				{ ...manifest, capabilities: ['native.objc.classes', 'native.objc.invoke'] },
				attributeAddon('plugins:test', 'test'),
			);
			const plan = context.native.objc.prepare(nativeHandle, 'description');

			context.native.objc.invokePrepared(plan, nativeHandle, []);

			expect(observed).toEqual([4, true, 4]);
			expect(cell[0]).toBe(0);
		} finally {
			Object.assign(bridge, { objc });
			Reflect.deleteProperty(nativePlatformBridge, 'crashGuard');
			resetCrashGuard();
		}
	});

	test('grants only the capabilities declared when the scope was built', async () => {
		const { createScopeGate } = await import('~/native/scope-gate');
		const capabilities: NativeBridgeCapability[] = ['native.ffi.symbols'];
		const { scopeMethod, requireGranted } = createScopeGate({
			capabilities,
			lifecycle: { disposed: false },
			track: (pending) => pending,
		});
		const call = scopeMethod(() => 'called', 'ffi.call');

		capabilities.push('native.ffi.call');

		expect(() => call()).toThrow(NativeBridgeCapabilityError);
		expect(() => requireGranted('ffi.call')).toThrow(NativeBridgeCapabilityError);
		expect(scopeMethod(() => 'called', 'ffi.call')).toThrow(NativeBridgeCapabilityError);
	});

	test('reports disposal before a missing capability, and a missing capability before a missing method', () => {
		const objc = bridge.objc;

		Object.assign(bridge, { objc: { ...objc, invokeAsync: undefined } });

		try {
			const declared = createPluginContext({
				...manifest,
				capabilities: ['native.objc.classes', 'native.objc.invokeAsync'],
			});
			const undeclared = createPluginContext({
				...manifest,
				capabilities: ['native.objc.classes'],
			});

			expect(() => declared.native.objc.invokeAsync(nativeHandle, 'description', [])).toThrow(
				NativeBridgeUnavailableError,
			);
			expect(() =>
				undeclared.native.objc.invokeAsync(nativeHandle, 'description', []),
			).toThrow(NativeBridgeCapabilityError);

			undeclared.dispose();

			expect(() =>
				undeclared.native.objc.invokeAsync(nativeHandle, 'description', []),
			).toThrow(NativeBridgeDisposedError);
			declared.dispose();
		} finally {
			Object.assign(bridge, { objc });
		}
	});
});
