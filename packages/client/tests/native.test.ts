import type {
	AddonManifest,
	NativeFabricSurface,
	NativePluginBridge,
	NativePluginRuntimeBridge,
	NativePlatformBridge,
	NativeSerializableObject,
	NativeHandle,
	NativeJavaArgument,
	NativeJavaHandle,
	NativeJavaHookToken,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/types';
import { afterEach, describe, expect, mock, test } from 'bun:test';

type NativePluginGlobal = typeof globalThis & {
	NativePlatform?: NativePlatformBridge;
	NativePlugin?: NativePluginRuntimeBridge;
};

mock.module('react-native', () => ({
	Alert: { alert: () => undefined },
	NativeModules: {},
	TurboModuleRegistry: { get: () => undefined },
	Switch: 'Switch',
	Text: 'Text',
	View: 'View',
}));

type FluxTestMessage = {
	author?: { bot?: boolean; id?: string; username?: string };
	channel_id?: string;
	content?: string;
	id?: string;
	nonce?: string;
};

type FluxTestEvent = { message?: FluxTestMessage };

type FluxTestListener = (event: FluxTestEvent) => void;

const fluxSubscriptions = new Map<string, Set<FluxTestListener>>();
const fluxDispatcher = {
	subscribe(event: string, listener: FluxTestListener) {
		const listeners = fluxSubscriptions.get(event) ?? new Set<FluxTestListener>();

		listeners.add(listener);
		fluxSubscriptions.set(event, listeners);
	},
	unsubscribe(event: string, listener: FluxTestListener) {
		const listeners = fluxSubscriptions.get(event);

		listeners?.delete(listener);

		if (listeners?.size === 0) {
			fluxSubscriptions.delete(event);
		}
	},
};

mock.module('~/api/metro/wrappers', () => ({
	findByPropsLazy: () => fluxDispatcher,
}));

const removed: string[] = [];
const cleared: unknown[] = [];
const unmounted: NativeFabricSurface[] = [];
const asynchronouslyUnmounted: NativeFabricSurface[] = [];
const cancelled: string[] = [];
const removedSubscriptions: string[] = [];
const javaInvokeArguments: (NativeJavaArgument[] | undefined)[] = [];
const javaReleased: NativeJavaHandle[] = [];
const javaHandle: NativeJavaHandle = Object.create(null);
const javaHookToken: NativeJavaHookToken = { id: 'hook-1' };
const hooksRemoved: NativeJavaHookToken[] = [];
const javaInvokeResult: NativeJavaValue = { type: 'string', value: 'invoked' };
const javaInvokeFailure = Object.assign(new Error('No method noSuchMethod'), {
	code: 'NATIVE_BRIDGE_ERROR',
});
let javaInvokeFails = false;
const nativeHandle: NativeHandle = Object.create(null);
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
	'native.java.classes',
	'native.java.construct',
	'native.java.fields',
	'native.java.invoke',
	'native.java.invokeAsync',
	'native.java.hooks',
	'native.java.batch',
	'native.java.associations',
	'native.fabric.mount',
	'native.fabric.async',
	'native.debug.evaluations',
	'native.debug.environment',
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
	java: {
		getClass: () => nativeHandle,
		className: () => ({ type: 'string', value: 'java.lang.Class' }),
		describe: (name: string) => ({
			name,
			superclass: 'java.lang.Object',
			interfaces: [],
			constructors: [[]],
			methods: [
				{ name: 'toString', parameters: [], returnType: 'java.lang.String', static: false },
			],
			fields: [],
		}),
		construct: () => javaHandle,
		respondsTo: () => ({ type: 'boolean', value: true }),
		invoke: (_handle: NativeJavaReference, _name: string, args?: NativeJavaArgument[]) => {
			javaInvokeArguments.push(args);

			if (javaInvokeFails) {
				throw javaInvokeFailure;
			}

			return javaInvokeResult;
		},
		invokeAsync: () => cancellable(Promise.resolve(javaInvokeResult), 'java-invoke'),
		getField: () => ({ type: 'int', value: 7 }),
		setField: () => undefined,
		release: (handle: NativeJavaHandle) => {
			javaReleased.push(handle);
		},
		batch: () => [{ type: 'int', value: 1 }],
		createAssociationKey: () => javaHandle,
		getAssociatedObject: () => ({ type: 'string', value: 'kept' }),
		setAssociatedObject: () => undefined,
	},
	hooks: {
		hook: () => javaHookToken,
		setReturnValue: () => undefined,
		removeReturnValue: () => undefined,
		clearReturnValues: () => undefined,
		remove: (token: NativeJavaHookToken) => {
			hooksRemoved.push(token);
		},
	},
	debug: {
		recordEvaluation: () => true,
		environment: () => ({ isVirtualDevice: true, hostAddress: '10.0.2.2' }),
	},
};
const iosSpecificBridges = {
	objc: bridge.objc,
	ffi: bridge.ffi,
	fabric: bridge.fabric,
};
const genericBridges = {
	runtime: bridge.runtime,
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

const iosPlatformDetails = {
	isVerifiedBuild: () => false,
	getEntitlements: () => ({}),
	getEntitlementsAsPlist: () => '',
};

const nativePlatformBridge: NativePlatformBridge = {
	platform: 'ios',
	evaluateBytecode: () => undefined,
	device: {
		platform: 'ios',
		getDeviceModel: () => '',
		getOSVersionString: () => '',
		isRooted: () => false,
		isSystemApp: () => false,
		isVirtualDevice: () => false,
	},
	app: { getAppSource: () => '' },
	ios: iosPlatformDetails,
};

(globalThis as NativePluginGlobal).NativePlugin = bridge;
(globalThis as NativePluginGlobal).NativePlatform = nativePlatformBridge;

const {
	NativePluginCapabilityError,
	NativePluginDisposedError,
	NativePluginPlatformError,
	NativePluginUnsupportedPlatformError,
	NativePluginVersionError,
} = await import('~/api/native');
const { createPluginContext, validateNativePluginRequirements, withNativeConstants } =
	await import('~/api/native-runtime');

afterEach(() => {
	Object.assign(bridge, { capabilities });
	Object.assign(bridge, iosSpecificBridges);
	Object.assign(bridge, genericBridges);
	Object.assign(nativePlatformBridge.device, { platform: 'ios' });
	Object.assign(nativePlatformBridge, { platform: 'ios', ios: iosPlatformDetails });
	removed.length = 0;
	cleared.length = 0;
	unmounted.length = 0;
	asynchronouslyUnmounted.length = 0;
	cancelled.length = 0;
	removedSubscriptions.length = 0;
	fluxSubscriptions.clear();
});

describe('native platform metadata', () => {
	test('uses platform-neutral names for shared device properties', () => {
		expect(nativePlatformBridge.device).toHaveProperty('getOSVersionString');
		expect(nativePlatformBridge.device).toHaveProperty('isRooted');
		expect(nativePlatformBridge.device).not.toHaveProperty('getiOSVersionString');
		expect(nativePlatformBridge.device).not.toHaveProperty('isJailbroken');
	});

	test('keeps iOS entitlement and attestation metadata out of the Android shape', () => {
		const androidPlatformBridge: NativePlatformBridge = {
			...nativePlatformBridge,
			platform: 'android',
			device: { ...nativePlatformBridge.device, platform: 'android' },
			ios: undefined,
		};

		expect(nativePlatformBridge.ios).toHaveProperty('getEntitlements');
		expect(nativePlatformBridge.ios).toHaveProperty('isVerifiedBuild');
		expect(androidPlatformBridge.ios).toBeUndefined();
	});
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

	test('uses the Flux dispatcher for bounded runtime events when the loader has no event adapter', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(bridge, {
			capabilities: ['native.runtime.events'],
			runtime: {
				subscribe: () => {
					throw new Error('unexpected host runtime adapter');
				},
			},
		});
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.runtime.events'],
		});
		const received: NativeSerializableObject[] = [];
		const token = context.native.runtime.subscribe('message.created', (payload) =>
			received.push(payload),
		);
		const listeners = fluxSubscriptions.get('MESSAGE_CREATE');
		const [listener] = listeners ? [...listeners] : [];

		listener?.({
			message: {
				author: { bot: false, id: 'user-1', username: 'User' },
				channel_id: 'channel-1',
				content: 'not exposed',
				id: 'message-1',
				nonce: 'nonce-1',
			},
		});

		expect(received).toEqual([
			{
				action: 'MESSAGE_CREATE',
				event: 'message.created',
				channelId: 'channel-1',
				guildId: null,
				messageId: 'message-1',
				userId: null,
				hasDraft: null,
				emoji: null,
				message: {
					id: 'message-1',
					channelId: 'channel-1',
					nonce: 'nonce-1',
					author: { id: 'user-1', username: 'User', bot: false },
				},
			},
		]);
		expect(received[0]).not.toHaveProperty('content');
		expect(token.active).toBe(true);
		token.remove();
		token.remove();
		expect(token.active).toBe(false);
		expect(fluxSubscriptions.has('MESSAGE_CREATE')).toBe(false);
		context.dispose();
	});
});

describe('native plugin negotiation', () => {
	test('supports a generic bridge without Objective-C, FFI, or Fabric namespaces', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		Object.assign(bridge, {
			capabilities: ['native.runtime.events'],
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
				android: ['native.java.classes'],
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
			platformCapabilities: {
				ios: ['native.objc.classes'],
				android: ['native.java.classes'],
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
				platformCapabilities: {
					android: ['native.java.hooks'],
				},
			}),
		).toThrow(NativePluginCapabilityError);
	});

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
		javaInvokeFails = true;

		const context = createPluginContext({
			...manifest,
			platforms: ['android'],
			capabilities: ['native.java.invoke'],
		});

		const call = () => context.native.java.invoke(nativeHandle, 'noSuchMethod');

		expect(call).toThrow(javaInvokeFailure);
		expect(call).toThrow('No method noSuchMethod');
		javaInvokeFails = false;
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
			'The native plugin bridge is unavailable.',
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

	test('rejects a plugin that does not support the host platform', () => {
		Object.assign(nativePlatformBridge.device, { platform: 'android' });
		Object.assign(nativePlatformBridge, { platform: 'android' });
		Object.assign(bridge, { capabilities: ['native.runtime.events', 'native.java.classes'] });

		const build = () =>
			createPluginContext({
				...manifest,
				platforms: ['ios'],
				capabilities: ['native.objc.classes'],
			});

		expect(build).toThrow(NativePluginUnsupportedPlatformError);
		expect(build).toThrow('This plugin supports ios; the host platform is android.');
	});

	test('builds a context for a plugin that supports the host platform', () => {
		const context = createPluginContext({
			...manifest,
			platforms: ['ios'],
			capabilities: ['native.objc.classes'],
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
				platformCapabilities: {
					android: ['native.java.classes'],
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
