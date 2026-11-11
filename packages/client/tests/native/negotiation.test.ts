import { afterEach, describe, expect, test } from 'bun:test';

import {
	NativePluginCapabilityError,
	NativePluginUnsupportedPlatformError,
	NativePluginVersionError,
	createPluginContext,
	validateNativeBridgeRequirements,
	nativeHandle,
	bridge,
	iosSpecificBridges,
	manifest,
	nativePlatformBridge,
	resetNativeFixtures,
} from '../helpers/native-bridge';

afterEach(resetNativeFixtures);

describe('native bridge negotiation', () => {
	test('supports an Android bridge without the Objective-C namespace', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		Object.assign(bridge, {
			capabilities: ['native.runtime.events'],
			objc: undefined,
		});

		const context = createPluginContext({
			...manifest,
			platforms: { android: { capabilities: ['native.runtime.events'] } },
		});

		expect(context.native.objc).toBeDefined();
		expect(context.native.ffi).toBeDefined();
		expect(context.native.fabric).toBeDefined();
		expect(context.native.runtime).toBeDefined();
		expect(() => context.native.objc.alloc('NSObject')).toThrow(NativePluginCapabilityError);
		expect(() => context.native.ffi.symbol('malloc')).toThrow(NativePluginCapabilityError);
		expect(() => context.native.fabric.mount(nativeHandle, 'TestSurface')).toThrow(
			NativePluginCapabilityError,
		);
		context.dispose();

		Object.assign(bridge, iosSpecificBridges);
	});

	test('selects capabilities for the current platform', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.runtime.events'],
			platforms: {
				ios: { capabilities: ['native.objc.classes'] },
				android: { capabilities: ['native.java.classes'] },
			},
		});

		expect(context.platform).toBe('ios');
		expect(context.capabilities).toEqual(['native.runtime.events', 'native.objc.classes']);
		context.dispose();

		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		Object.assign(bridge, {
			capabilities: ['native.runtime.events', 'native.java.classes'],
		});
		const androidContext = createPluginContext({
			...manifest,
			capabilities: ['native.runtime.events'],
			platforms: {
				ios: { capabilities: ['native.objc.classes'] },
				android: { capabilities: ['native.java.classes'] },
			},
		});

		expect(androidContext.platform).toBe('android');
		expect(androidContext.capabilities).toEqual([
			'native.runtime.events',
			'native.java.classes',
		]);
		androidContext.dispose();
	});

	test('rejects capabilities missing from the active platform bridge', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		Object.assign(bridge, {
			capabilities: ['native.runtime.events'],
		});

		expect(() =>
			createPluginContext({
				...manifest,
				platforms: { android: { capabilities: ['native.java.hooks'] } },
			}),
		).toThrow(NativePluginCapabilityError);
	});

	test('rejects a plugin that does not support the host platform', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		Object.assign(bridge, { capabilities: ['native.runtime.events', 'native.java.classes'] });

		const build = () =>
			createPluginContext({
				...manifest,
				platforms: { ios: { capabilities: ['native.objc.classes'] } },
			});

		expect(build).toThrow(NativePluginUnsupportedPlatformError);
		expect(build).toThrow(/\bios\b/);
		expect(build).toThrow(/\bandroid\b/);
	});

	test('builds a context for a plugin that supports the host platform', () => {
		const context = createPluginContext({
			...manifest,
			platforms: { ios: { capabilities: ['native.objc.classes'] } },
		});

		expect(context.platform).toBe('ios');
		expect(context.capabilities).toEqual(['native.objc.classes']);
		context.dispose();
	});

	test('rejects platform-scoped capabilities when the host platform is unknown', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'unknown' });
		Object.assign(nativePlatformBridge, { platform: 'unknown' });

		expect(() =>
			createPluginContext({
				...manifest,
				platforms: { android: { capabilities: ['native.java.classes'] } },
			}),
		).toThrow(NativePluginUnsupportedPlatformError);
	});

	test('rejects capabilities that the bridge does not advertise', () => {
		expect(() =>
			validateNativeBridgeRequirements(['native.objc.hooks', 'native.ffi.call'], '1.0.0'),
		).not.toThrow();
		expect(() =>
			validateNativeBridgeRequirements([
				'native.objc.hooks',
				'native.ffi.call',
				'native.unknown' as never,
			]),
		).toThrow(NativePluginCapabilityError);
	});

	test('rejects a plugin that requires a newer bridge API', () => {
		let failure: unknown;

		try {
			validateNativeBridgeRequirements([], '2.0.0');
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(NativePluginVersionError);
		expect(failure).toMatchObject({
			code: 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED',
			installedApi: '1.0.0',
			requiredApi: '2.0.0',
		});
	});

	test('orders a prerelease bridge API before its release', () => {
		Object.assign(bridge, { apiVersion: '1.0.0-beta.1' });

		expect(() => validateNativeBridgeRequirements([], '1.0.0')).toThrow(
			NativePluginVersionError,
		);
		expect(() => validateNativeBridgeRequirements([], '1.0.0-alpha.2')).not.toThrow();
	});
});
