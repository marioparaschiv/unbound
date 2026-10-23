import type {
	AddonManifest,
	NativeFabricSurface,
	NativePluginBridge,
	NativePluginRuntimeBridge,
	NativePlatformBridge,
	NativeFabricBridge,
	NativeFFIBridge,
	NativeObjCBridge,
	NativeUIHandle,
} from '@unbound-app/types';
import { afterEach, describe, expect, mock, test } from 'bun:test';

type NativePluginGlobal = typeof globalThis & {
	NativePlatform?: NativePlatformBridge;
	NativePlugin?: NativePluginRuntimeBridge;
};

mock.module('react-native', () => ({
	NativeModules: {},
	TurboModuleRegistry: { get: () => undefined },
}));

const removed: string[] = [];
const cleared: unknown[] = [];
const unmounted: NativeFabricSurface[] = [];
const asynchronouslyUnmounted: NativeFabricSurface[] = [];
const cancelled: string[] = [];
const sizeHeightFloors: unknown[][] = [];
const removedSubscriptions: string[] = [];
const uiUnmounted: NativeUIHandle[] = [];
const nativeHandle: NativeUIHandle = Object.create(null);
const capabilities = [
	'native.objc.classes',
	'native.objc.invoke',
	'native.objc.invokeAsync',
	'native.objc.batch',
	'native.objc.snapshot',
	'native.objc.ivars',
	'native.objc.associations',
	'native.objc.hooks',
	'native.ffi.symbols',
	'native.ffi.call',
	'native.fabric.mount',
	'native.fabric.async',
	'native.runtime.events',
	'native.ui.lookup',
	'native.ui.mount',
	'native.ui.layout',
	'native.media.pick',
	'native.media.access',
] as const;

function cancellable<T>(promise: Promise<T>, name: string) {
	return Object.assign(promise, { cancel: () => cancelled.push(name) });
}

const bridge: NativePluginBridge = {
	abiVersion: '1.0.0',
	apiVersion: '1.0.0',
	capabilities,
	objc: {
		alloc: () => nativeHandle,
		array: () => [],
		call: () => undefined,
		callSuper: () => undefined,
		className: () => 'NSObject',
		createAssociationKey: () => nativeHandle,
		data: () => nativeHandle,
		getAssociatedObject: () => null,
		getClass: () => nativeHandle,
		getIvar: () => null,
		invoke: () => undefined,
		invokeAsync: () => cancellable(new Promise(() => undefined), 'invoke'),
		batch: (steps: readonly unknown[]) => cancellable(Promise.resolve([...steps]), 'batch'),
		snapshot: () => cancellable(Promise.resolve([]), 'snapshot'),
		findViews: () => cancellable(Promise.resolve([]), 'findViews'),
		invokeSuper: () => undefined,
		invokeSuperAsync: () => cancellable(new Promise(() => undefined), 'invokeSuper'),
		hook: () => ({
			active: true,
			setReturnValue: () => undefined,
			removeReturnValue: () => undefined,
			clearReturnValues: () => undefined,
			setSizeHeightFloor: (...values: unknown[]) => sizeHeightFloors.push(values),
			removeSizeHeightFloor: (...values: unknown[]) => sizeHeightFloors.push(values),
			remove: () => removed.push('hook'),
		}),
		respondsTo: () => false,
		setAssociatedObject: (...args: unknown[]) => cleared.push(args),
		setIvar: () => undefined,
		struct: () => Object.assign(Object.create(null), { name: 'NSObject' }),
	},
	ffi: {
		call: () => undefined,
		symbol: () => null,
	},
	fabric: {
		mount: () => nativeHandle,
		mountAsync: () => cancellable(Promise.resolve(nativeHandle), 'mount'),
		update: () => undefined,
		updateAsync: () => cancellable(Promise.resolve(), 'update'),
		setSize: () => undefined,
		setSizeAsync: () => cancellable(Promise.resolve(), 'size'),
		setFrame: () => undefined,
		setFrameAsync: () => cancellable(Promise.resolve(), 'frame'),
		measure: () => ({ x: 0, y: 0, width: 0, height: 0 }),
		measureAsync: () => cancellable(new Promise(() => undefined), 'measure'),
		unmount: (surface: NativeFabricSurface) => unmounted.push(surface),
		unmountAsync: (surface: NativeFabricSurface) => {
			asynchronouslyUnmounted.push(surface);

			return cancellable(Promise.resolve(), 'unmount');
		},
	},
	runtime: {
		subscribe: (event: string) => ({
			active: true,
			remove: () => removedSubscriptions.push(event),
		}),
	},
	ui: {
		lookup: () => cancellable(Promise.resolve([]), 'ui-lookup'),
		snapshot: () => cancellable(Promise.resolve({ generation: 1, nodes: [] }), 'ui-snapshot'),
		mount: () => cancellable(Promise.resolve(nativeHandle), 'ui-mount'),
		update: () => cancellable(Promise.resolve(), 'ui-update'),
		setFrame: () => cancellable(Promise.resolve(), 'ui-frame'),
		measure: () =>
			cancellable(Promise.resolve({ x: 0, y: 0, width: 0, height: 0 }), 'ui-measure'),
		unmount: (handle: NativeUIHandle) => {
			uiUnmounted.push(handle);

			return cancellable(Promise.resolve(), 'ui-unmount');
		},
	},
	media: {
		pick: () => cancellable(Promise.resolve([]), 'media-pick'),
		inspect: () =>
			cancellable(
				Promise.resolve({ uri: '', fileName: '', mimeType: '', fileSize: 0 }),
				'media-inspect',
			),
		copy: () =>
			cancellable(
				Promise.resolve({ uri: '', fileName: '', mimeType: '', fileSize: 0 }),
				'media-copy',
			),
		read: () => cancellable(Promise.resolve(new ArrayBuffer(0)), 'media-read'),
	},
};
const iosSpecificBridges = {
	objc: bridge.objc as NativeObjCBridge,
	ffi: bridge.ffi as NativeFFIBridge,
	fabric: bridge.fabric as NativeFabricBridge,
};

const manifest: AddonManifest = {
	authors: [{ id: '1', name: 'test' }],
	description: 'test',
	folder: '',
	icon: '',
	id: 'test',
	main: 'index.js',
	name: 'test',
	path: '',
	updates: '',
	url: '',
	version: '1.0.0',
};

const nativePlatformBridge: NativePlatformBridge = {
	platform: 'ios',
	evaluateBytecode: () => undefined,
	device: {
		platform: 'ios',
		getDeviceModel: () => '',
		getiOSVersionString: () => '',
		isJailbroken: () => false,
		isSystemApp: () => false,
		isVerifiedBuild: () => false,
		getEntitlements: () => ({}),
		getEntitlementsAsPlist: () => '',
	},
	app: { getAppSource: () => '' },
};

(globalThis as NativePluginGlobal).NativePlugin = bridge;
(globalThis as NativePluginGlobal).NativePlatform = nativePlatformBridge;

const {
	NativePluginCapabilityError,
	NativePluginDisposedError,
	NativePluginPlatformError,
	NativePluginVersionError,
} = await import('~/api/native');
const { createPluginContext, validateNativePluginRequirements } =
	await import('~/api/native-runtime');

afterEach(() => {
	Object.assign(bridge, { capabilities });
	Object.assign(bridge, iosSpecificBridges);
	Object.assign(nativePlatformBridge.device, { platform: 'ios' });
	Object.assign(nativePlatformBridge, { platform: 'ios' });
	removed.length = 0;
	cleared.length = 0;
	unmounted.length = 0;
	asynchronouslyUnmounted.length = 0;
	cancelled.length = 0;
	sizeHeightFloors.length = 0;
	removedSubscriptions.length = 0;
	uiUnmounted.length = 0;
});

describe('native plugin capability scopes', () => {
	test('hides the raw bridge after capturing it for scoped access', async () => {
		const nativeApi = await import('~/api/native');

		expect((globalThis as NativePluginGlobal).NativePlugin).toBeUndefined();
		expect(nativeApi).not.toHaveProperty('NativePlugin');
		expect(nativeApi).not.toHaveProperty('createPluginContext');
		expect(nativeApi).not.toHaveProperty('validateNativePluginRequirements');
	});

	test('denies operations that are outside the declared scope', () => {
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.classes'] });

		const handle = context.native.objc.alloc('NSObject');

		expect(context.manifest.id).toBe('test');
		expect(() => context.native.objc.invoke(handle, 'description', [])).toThrow(
			NativePluginCapabilityError,
		);
	});

	test('disposes hooks owned by a plugin context', () => {
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.hooks'] });
		const token = context.native.objc.hook('NSObject', 'description', {
			after: () => undefined,
		});

		expect(token.active).toBe(true);
		context.dispose();
		expect(removed).toEqual(['hook']);
	});

	test('scopes cached height floors to hooks owned by a plugin context', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.objc.hooks'],
		});
		const token = context.native.objc.hook('UIView', 'sizeThatFits:', {}, { cacheOnly: true });
		const handle = context.native.objc.alloc('NSObject');
		const args = [{ width: 375, height: 0 }];

		token.setSizeHeightFloor(handle, args, 136);
		token.removeSizeHeightFloor(handle, args);
		expect(sizeHeightFloors).toEqual([
			[handle, args, 136],
			[handle, args],
		]);
		context.dispose();
		expect(() => token.setSizeHeightFloor(handle, args, 136)).toThrow(
			NativePluginDisposedError,
		);
	});

	test('clears associations and denies calls after disposal', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.objc.associations'],
		});
		const handle = context.native.objc.alloc('NSObject');
		const key = context.native.objc.createAssociationKey();

		context.native.objc.setAssociatedObject(handle, key, { value: true });
		cleared.length = 0;
		context.dispose();

		expect(cleared).toHaveLength(1);
		expect(cleared[0]).toEqual([handle, key, null, 'assign']);
		expect(() => context.native.objc.getAssociatedObject(handle, key)).toThrow(
			NativePluginDisposedError,
		);
		context.dispose();
	});

	test('disposes Fabric surfaces owned by a plugin context', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.fabric.mount'],
		});
		const surface = context.native.fabric.mount(
			context.native.objc.alloc('UIView'),
			'TestSurface',
		);

		context.dispose();

		expect(asynchronouslyUnmounted).toEqual([surface]);
		expect(unmounted).toEqual([]);
	});

	test('gates asynchronous Objective-C operations by capability', async () => {
		const denied = createPluginContext({ ...manifest, capabilities: ['native.objc.classes'] });
		const deniedHandle = denied.native.objc.alloc('NSObject');

		expect(() => denied.native.objc.batch([])).toThrow(NativePluginCapabilityError);
		expect(() => denied.native.objc.snapshot(deniedHandle)).toThrow(
			NativePluginCapabilityError,
		);
		expect(() => denied.native.objc.findViews(deniedHandle, 'UIView')).toThrow(
			NativePluginCapabilityError,
		);

		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.objc.batch', 'native.objc.snapshot'],
		});
		const handle = context.native.objc.alloc('NSObject');

		expect(await context.native.objc.batch([])).toEqual([]);
		expect(await context.native.objc.snapshot(handle)).toEqual([]);
		expect(await context.native.objc.findViews(handle, 'UIView')).toEqual([]);
		context.dispose();
	});

	test('cancels pending Objective-C operations when a plugin context stops', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.objc.invokeAsync', 'native.objc.invoke'],
		});
		const handle = context.native.objc.alloc('NSObject');

		context.native.objc.invokeAsync(handle, 'description', []);
		context.native.objc.invokeSuperAsync(handle, 'NSObject', 'description', []);
		context.dispose();

		expect(cancelled).toEqual(['invoke', 'invokeSuper']);
	});

	test('tracks asynchronous Fabric surfaces and cancels pending operations on stop', async () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.classes', 'native.fabric.async'],
		});
		const view = context.native.objc.alloc('UIView');
		const surface = await context.native.fabric.mountAsync(view, 'TestSurface');

		context.native.fabric.measureAsync(view);
		context.dispose();

		expect(asynchronouslyUnmounted).toEqual([surface]);
		expect(cancelled).toContain('measure');
	});

	test('removes runtime subscriptions when a plugin context stops', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.runtime.events'],
		});
		const token = context.native.runtime.subscribe('message.created', () => undefined);

		expect(token.active).toBe(true);
		context.dispose();
		expect(removedSubscriptions).toEqual(['message.created']);
	});

	test('gates semantic UI and media operations by capability', () => {
		const context = createPluginContext({ ...manifest, capabilities: [] });

		expect(() => context.native.ui.lookup({ role: 'message' })).toThrow(
			NativePluginCapabilityError,
		);
		expect(() => context.native.media.pick({ mediaTypes: ['image'] })).toThrow(
			NativePluginCapabilityError,
		);
	});

	test('unmounts semantic UI surfaces when a plugin context stops', async () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.ui.mount'],
		});
		const handle = await context.native.ui.mount(null, 'MessagePreview', { id: 'message-1' });

		context.dispose();
		await Promise.resolve();
		expect(uiUnmounted).toEqual([handle]);
	});

	test('cancels media access operations when a plugin context stops', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.media.pick'],
		});

		context.native.media.pick({ mediaTypes: ['image', 'video'] });
		context.dispose();
		expect(cancelled).toContain('media-pick');
	});
});

describe('native plugin negotiation', () => {
	test('supports a generic bridge without Objective-C, FFI, or Fabric namespaces', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		Object.assign(bridge, {
			capabilities: ['native.runtime.events', 'native.ui.lookup', 'native.media.access'],
			objc: undefined,
			ffi: undefined,
			fabric: undefined,
		});

		const context = createPluginContext({
			...manifest,
			platformCapabilities: { android: ['native.runtime.events'] },
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
			platformCapabilities: {
				ios: ['native.objc.classes'],
				android: ['native.ui.lookup'],
			},
		});

		expect(context.platform).toBe('ios');
		expect(context.capabilities).toEqual(['native.runtime.events', 'native.objc.classes']);
		context.dispose();

		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		Object.assign(bridge, {
			capabilities: ['native.runtime.events', 'native.ui.lookup'],
		});
		const androidContext = createPluginContext({
			...manifest,
			capabilities: ['native.runtime.events'],
			platformCapabilities: {
				ios: ['native.objc.classes'],
				android: ['native.ui.lookup'],
			},
		});

		expect(androidContext.platform).toBe('android');
		expect(androidContext.capabilities).toEqual(['native.runtime.events', 'native.ui.lookup']);
		androidContext.dispose();
	});

	test('rejects capabilities missing from the active platform bridge', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		Object.assign(bridge, {
			capabilities: ['native.runtime.events', 'native.ui.lookup'],
		});

		expect(() =>
			createPluginContext({
				...manifest,
				platformCapabilities: {
					android: ['native.media.access'],
				},
			}),
		).toThrow(NativePluginCapabilityError);
	});

	test('rejects platform-scoped capabilities when the host platform is unknown', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'unknown' });
		Object.assign(nativePlatformBridge, { platform: 'unknown' });

		expect(() =>
			createPluginContext({
				...manifest,
				platformCapabilities: {
					android: ['native.ui.lookup'],
				},
			}),
		).toThrow(NativePluginPlatformError);
	});

	test('rejects capabilities that the bridge does not advertise', () => {
		expect(() =>
			validateNativePluginRequirements(['native.objc.hooks', 'native.ffi.call'], '1.0.0'),
		).not.toThrow();
		expect(() =>
			validateNativePluginRequirements([
				'native.objc.hooks',
				'native.ffi.call',
				'native.unknown' as never,
			]),
		).toThrow(NativePluginCapabilityError);
	});

	test('rejects a plugin that requires a newer bridge API', () => {
		let failure: unknown;

		try {
			validateNativePluginRequirements([], '2.0.0');
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
});
