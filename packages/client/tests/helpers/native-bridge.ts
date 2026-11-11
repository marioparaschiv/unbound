import type {
	AddonManifest,
	NativeFabricSurface,
	NativePluginBridge,
	NativePluginRuntimeBridge,
	NativeJavaBridge,
	NativeResourceCounts,
	NativeUIScope,
	NativeUIScopeFactory,
	NativePlatformBridge,
	NativeHandle,
	NativeJavaArgument,
	NativeJavaCallPlan,
	NativeObjCCallPlan,
	NativeObjCResult,
	NativeBatchStep,
	NativeJavaHandle,
	NativeJavaHookToken,
	NativeJavaReference,
	NativeJavaValue,
	LoaderObjCBridge,
} from '@unbound-app/types';
import { mock } from 'bun:test';

import { mockLookups } from './lookups';

// Importing the native API captures and deletes `globalThis.NativePlugin`, so each file using these
// fixtures needs its own module registry: run them with `bun test --isolate`.
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

export const fluxSubscriptions = new Map<string, Set<FluxTestListener>>();
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

mockLookups({
	find: () => fluxDispatcher,
	findByProps: () => fluxDispatcher,
});

export const removed: string[] = [];
export const cleared: unknown[] = [];
export const unmounted: NativeFabricSurface[] = [];
export const asynchronouslyUnmounted: NativeFabricSurface[] = [];
export const cancelled: string[] = [];
export const javaInvokeArguments: (NativeJavaArgument[] | undefined)[] = [];
export const javaReleased: NativeJavaHandle[] = [];
export const javaHandle: NativeJavaHandle = Object.create(null);
const javaCallPlan: NativeJavaCallPlan = Object.create(null);
const objcCallPlan: NativeObjCCallPlan = Object.create(null);

export const javaHookToken: NativeJavaHookToken = { id: 'hook-1' };
export const hooksRemoved: NativeJavaHookToken[] = [];
export const javaPlansDisposed: NativeJavaCallPlan[] = [];
export const objcPlansDisposed: NativeObjCCallPlan[] = [];
const javaInvokeResult: NativeJavaValue = { type: 'string', value: 'invoked' };

/** Set `fails` to make the Java bridge's `invoke` throw {@link javaInvokeFailure}. */
export const javaInvoke = { fails: false };
export const javaInvokeFailure = Object.assign(new Error('No method noSuchMethod'), {
	code: 'NATIVE_BRIDGE_ERROR',
});
export const nativeHandle: NativeHandle = Object.create(null);
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

/**
 * @description Makes a promise cancellable the way the native bridge's are, recording each cancel.
 * @template T The promise's value.
 * @param promise The promise.
 * @param name The name recorded in {@link cancelled} when it is cancelled.
 * @returns The promise with a `cancel` method.
 */
export function cancellable<T>(promise: Promise<T>, name: string) {
	return Object.assign(promise, { cancel: () => cancelled.push(name) });
}

type LoaderBridge = Omit<NativePluginBridge, 'objc' | 'java' | 'runtime' | 'ui'> & {
	objc: LoaderObjCBridge;
	java: NativeJavaBridge & NativeUIScopeFactory;
};

function createUnavailableUIScope(): NativeUIScope {
	throw Object.assign(new Error('UI-runtime native scopes are unavailable.'), {
		code: 'NATIVE_PLUGIN_UNAVAILABLE',
	});
}

const idleResources: NativeResourceCounts = {
	hooks: 0,
	surfaces: 0,
	cachedReturns: 0,
	handles: 0,
	leases: 0,
	objcHandles: 0,
	objcPlans: 0,
	objcRetains: 0,
	javaHandles: 0,
	idleSurfaces: 0,
	createdSurfaces: 0,
	reusedSurfaces: 0,
	mainWork: { drains: 0, items: 0, drainMs: 0, maxDrainMs: 0, maxDrainItems: 0 },
	mainWaits: [],
};

const fakeBridge: LoaderBridge = {
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
		createUIScope: createUnavailableUIScope,
		data: () => nativeHandle,
		getAssociatedObject: () => null,
		getClass: () => nativeHandle,
		getIvar: () => null,
		invoke: () => undefined,
		invokeAsync: () => cancellable(new Promise(() => undefined), 'invoke'),
		prepare: () => objcCallPlan,
		invokePrepared: () => undefined,
		invokePreparedAsync: () =>
			cancellable(new Promise(() => undefined), 'objc-invoke-prepared'),
		disposePlan: (plan: NativeObjCCallPlan) => {
			objcPlansDisposed.push(plan);
		},
		batch: (steps: readonly NativeBatchStep[]) =>
			cancellable(Promise.resolve(steps.map((): NativeObjCResult => undefined)), 'batch'),
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
		batchAsync: () => cancellable(Promise.resolve(), 'batch'),
		measure: () => ({ x: 0, y: 0, width: 0, height: 0 }),
		measureAsync: () => cancellable(new Promise(() => undefined), 'measure'),
		unmount: (surface: NativeFabricSurface) => unmounted.push(surface),
		unmountAsync: (surface: NativeFabricSurface) => {
			asynchronouslyUnmounted.push(surface);

			return cancellable(Promise.resolve(), 'unmount');
		},
		releaseIdle: () => undefined,
		releaseIdleAsync: () => cancellable(Promise.resolve(), 'releaseIdle'),
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

			if (javaInvoke.fails) {
				throw javaInvokeFailure;
			}

			return javaInvokeResult;
		},
		prepare: () => javaCallPlan,
		invokePrepared: (_plan, _target, args) => {
			javaInvokeArguments.push(args);

			return javaInvokeResult;
		},
		invokePreparedAsync: () =>
			cancellable(Promise.resolve(javaInvokeResult), 'java-invoke-prepared'),
		disposePlan: (plan) => {
			javaPlansDisposed.push(plan);
		},
		invokeAsync: () => cancellable(Promise.resolve(javaInvokeResult), 'java-invoke'),
		getField: () => ({ type: 'int', value: 7 }),
		setField: () => undefined,
		release: (handle: NativeJavaHandle) => {
			javaReleased.push(handle);
		},
		batch: () => [{ type: 'int', value: 1 }],
		batchAsync: () => cancellable(Promise.resolve([{ type: 'int', value: 1 }]), 'java-batch'),
		findViews: () => cancellable(Promise.resolve([]), 'java-findViews'),
		createAssociationKey: () => javaHandle,
		createUIScope: createUnavailableUIScope,
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
		environment: () => ({
			isVirtualDevice: true,
			hostAddress: '10.0.2.2',
			resources: idleResources,
		}),
	},
};

export const iosSpecificBridges = {
	objc: fakeBridge.objc,
	ffi: fakeBridge.ffi,
	fabric: fakeBridge.fabric,
};

export const manifest: AddonManifest = {
	authors: [{ id: '1', name: 'test' }],
	description: 'test',
	id: 'test',
	main: 'index.js',
	name: 'test',
	version: '1.0.0',
};

const iosPlatformDetails = {
	getEntitlements: () => ({}),
	getEntitlementsAsPlist: () => '',
};

const fakePlatformBridge: NativePlatformBridge = {
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
	app: {
		getAppSource: () => '',
		getFramework: () => '',
		isVerifiedBuild: () => false,
		claimLaunchURL: () => true,
	},
	addons: {
		verify: () => ({ status: 'unsigned' }),
		evaluateBytecode: () => undefined,
		readSource: () => undefined,
	},
	profiler: {
		start: () => false,
		stop: () => undefined,
	},
	ios: iosPlatformDetails,
};

/** The fake native plugin bridge the loader would install; tests swap its namespaces with `Object.assign`. */
export const bridge = fakeBridge;
/** The fake host platform bridge; tests switch its platform with `Object.assign`. */
export const nativePlatformBridge = fakePlatformBridge;

(globalThis as NativePluginGlobal).NativePlugin = bridge;
(globalThis as NativePluginGlobal).NativePlatform = nativePlatformBridge;

export const {
	NativePluginCapabilityError,
	NativePluginDisposedError,
	NativePluginUnavailableError,
	NativePluginUnsupportedPlatformError,
	NativePluginVersionError,
} = require('~/native/native') as typeof import('~/native/native');
export const { validateNativePluginRequirements } =
	require('~/native/capabilities') as typeof import('~/native/capabilities');
export const { createPluginContext } =
	require('~/native/plugin-context') as typeof import('~/native/plugin-context');
export const { withNativeConstants } =
	require('~/native/runtime') as typeof import('~/native/runtime');

/**
 * @description Puts the fake bridges back to the iOS defaults and empties every recorded call.
 */
export function resetNativeFixtures(): void {
	Object.assign(bridge, { capabilities, apiVersion: '1.0.0' });
	Object.assign(bridge, iosSpecificBridges);
	Object.assign(bridge.objc, { createUIScope: createUnavailableUIScope });
	Object.assign(bridge.java, { createUIScope: createUnavailableUIScope });
	Object.assign(nativePlatformBridge.device, { platform: 'ios' });
	Object.assign(nativePlatformBridge, { platform: 'ios', ios: iosPlatformDetails });
	removed.length = 0;
	cleared.length = 0;
	unmounted.length = 0;
	asynchronouslyUnmounted.length = 0;
	cancelled.length = 0;
	javaInvokeArguments.length = 0;
	javaReleased.length = 0;
	javaPlansDisposed.length = 0;
	objcPlansDisposed.length = 0;
	fluxSubscriptions.clear();
}
