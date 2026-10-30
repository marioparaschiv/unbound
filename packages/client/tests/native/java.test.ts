import type { NativeFabricSurface } from '@unbound-app/types';
import { afterEach, describe, expect, test } from 'bun:test';

import {
	NativePluginCapabilityError,
	NativePluginDisposedError,
	NativePluginUnavailableError,
	createPluginContext,
	javaInvokeArguments,
	javaReleased,
	javaHandle,
	javaHookToken,
	hooksRemoved,
	javaInvoke,
	javaInvokeFailure,
	nativeHandle,
	cancellable,
	bridge,
	manifest,
	nativePlatformBridge,
	resetNativeFixtures,
} from '../helpers/native-bridge';

afterEach(resetNativeFixtures);

describe('native Java bridge', () => {
	test('scopes the Java bridge to the capabilities a plugin declares', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });

		const context = createPluginContext({
			...manifest,
			platforms: ['android'],
			capabilities: ['native.java.classes', 'native.java.invoke'],
		});

		expect(context.native.java.getClass('java.lang.Integer')).toBe(nativeHandle);
		expect(context.native.java.invoke(nativeHandle, 'toString')).toEqual({
			type: 'string',
			value: 'invoked',
		});
		expect(() => context.native.java.getField(nativeHandle, 'value')).toThrow(
			NativePluginCapabilityError,
		);
		expect(() => context.native.java.construct('java.lang.StringBuilder')).toThrow(
			NativePluginCapabilityError,
		);
		context.dispose();
	});

	test('passes an empty argument list when a Java call omits one', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		javaInvokeArguments.length = 0;

		const context = createPluginContext({
			...manifest,
			platforms: ['android'],
			capabilities: ['native.java.classes', 'native.java.invoke'],
		});

		context.native.java.invoke(nativeHandle, 'toString');

		expect(javaInvokeArguments).toEqual([[]]);
		context.dispose();
	});

	test('releases the Java handles a plugin acquired when its scope is disposed', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		javaReleased.length = 0;

		const context = createPluginContext({
			...manifest,
			platforms: ['android'],
			capabilities: ['native.java.classes', 'native.java.construct'],
		});

		context.native.java.getClass('java.lang.Integer');
		context.native.java.construct('java.lang.StringBuilder');
		context.dispose();

		expect(javaReleased).toEqual([nativeHandle, javaHandle]);
	});

	test('rejects Java calls once the plugin scope is disposed', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });

		const context = createPluginContext({
			...manifest,
			platforms: ['android'],
			capabilities: ['native.java.classes'],
		});

		context.dispose();

		expect(() => context.native.java.getClass('java.lang.Integer')).toThrow(
			NativePluginDisposedError,
		);
	});

	test('propagates coded native Java errors unchanged', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		javaInvoke.fails = true;

		const context = createPluginContext({
			...manifest,
			platforms: ['android'],
			capabilities: ['native.java.invoke'],
		});

		const call = () => context.native.java.invoke(nativeHandle, 'noSuchMethod');

		expect(call).toThrow(javaInvokeFailure);
		expect(call).toThrow('No method noSuchMethod');
		javaInvoke.fails = false;
		context.dispose();
	});

	test('routes Android Fabric surfaces to the native async namespace', async () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		const androidSurface: NativeFabricSurface = Object.create(null);
		const androidUnmounted: NativeFabricSurface[] = [];

		Object.assign(bridge, {
			objc: undefined,
			fabric: {
				mountAsync: () => cancellable(Promise.resolve(androidSurface), 'android-mount'),
				unmountAsync: (surface: NativeFabricSurface) => {
					androidUnmounted.push(surface);

					return cancellable(Promise.resolve(), 'android-unmount');
				},
			},
		});

		const context = createPluginContext({
			...manifest,
			platforms: ['android'],
			capabilities: ['native.fabric.async'],
		});

		expect(await context.native.fabric.mountAsync(nativeHandle, 'AndroidSurface')).toBe(
			androidSurface,
		);
		expect(() => context.native.fabric.mount(nativeHandle, 'AndroidSurface')).toThrow(
			NativePluginCapabilityError,
		);
		expect(() => context.native.fabric.measureAsync(nativeHandle)).toThrow(
			NativePluginUnavailableError,
		);
		context.dispose();
		expect(androidUnmounted).toEqual([androidSurface]);
	});

	test('scopes Java hooks to the capability a plugin declares', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		hooksRemoved.length = 0;

		const denied = createPluginContext({
			...manifest,
			platforms: ['android'],
			capabilities: ['native.java.classes'],
		});

		expect(() => denied.native.hooks.hook('java.lang.Integer', 'toString', [])).toThrow(
			NativePluginCapabilityError,
		);
		denied.dispose();

		const context = createPluginContext({
			...manifest,
			platforms: ['android'],
			capabilities: ['native.java.hooks'],
		});

		expect(context.native.hooks.hook('java.lang.Integer', 'toString', [])).toBe(javaHookToken);
		context.dispose();

		expect(hooksRemoved).toEqual([javaHookToken]);
	});

	test('scopes batching, associations and debug to their capabilities', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });

		const denied = createPluginContext({
			...manifest,
			platforms: ['android'],
			capabilities: ['native.java.classes'],
		});

		expect(() => denied.native.java.batch([])).toThrow(NativePluginCapabilityError);
		expect(() => denied.native.java.createAssociationKey()).toThrow(
			NativePluginCapabilityError,
		);
		expect(() => denied.native.debug.environment()).toThrow(NativePluginCapabilityError);
		denied.dispose();

		const context = createPluginContext({
			...manifest,
			platforms: ['android'],
			capabilities: [
				'native.java.batch',
				'native.java.associations',
				'native.debug.evaluations',
				'native.debug.environment',
			],
		});

		expect(context.native.java.batch([])).toEqual([{ type: 'int', value: 1 }]);
		expect(context.native.java.getAssociatedObject(nativeHandle, javaHandle)).toEqual({
			type: 'string',
			value: 'kept',
		});
		expect(context.native.debug.environment()).toEqual({
			isVirtualDevice: true,
			hostAddress: '10.0.2.2',
		});
		expect(context.native.debug.recordEvaluation({ id: 'e1', code: '1', ok: true })).toBe(true);
		context.dispose();
	});
});
