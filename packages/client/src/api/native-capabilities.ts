import type {
	NativeDebugBridge,
	NativeFabricBridge,
	NativeFFIBridge,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeObjCBridge,
	NativePluginBridge,
	NativePluginCapability,
	NativeRuntimeBridge,
} from '@unbound-app/types';

import {
	NativePluginCapabilityError,
	NativePluginDisposedError,
	NativePluginUnavailableError,
} from '~/api/native-errors';

type CapabilityTable<T> = Record<keyof T, NativePluginCapability>;

export const objcCapabilities: CapabilityTable<NativeObjCBridge> = {
	getClass: 'native.objc.classes',
	alloc: 'native.objc.classes',
	className: 'native.objc.classes',
	respondsTo: 'native.objc.classes',
	call: 'native.objc.invoke',
	callSuper: 'native.objc.invoke',
	invoke: 'native.objc.invoke',
	invokeAsync: 'native.objc.invokeAsync',
	batch: 'native.objc.batch',
	snapshot: 'native.objc.snapshot',
	findViews: 'native.objc.snapshot',
	invokeSuper: 'native.objc.invoke',
	invokeSuperAsync: 'native.objc.invokeAsync',
	getIvar: 'native.objc.ivars',
	setIvar: 'native.objc.ivars',
	createAssociationKey: 'native.objc.associations',
	getAssociatedObject: 'native.objc.associations',
	setAssociatedObject: 'native.objc.associations',
	struct: 'native.objc.classes',
	array: 'native.objc.classes',
	data: 'native.objc.classes',
	hook: 'native.objc.hooks',
};

export const ffiCapabilities: CapabilityTable<NativeFFIBridge> = {
	symbol: 'native.ffi.symbols',
	call: 'native.ffi.call',
};

export const fabricCapabilities: CapabilityTable<NativeFabricBridge> = {
	mount: 'native.fabric.mount',
	update: 'native.fabric.mount',
	setSize: 'native.fabric.mount',
	setFrame: 'native.fabric.mount',
	measure: 'native.fabric.mount',
	unmount: 'native.fabric.mount',
	mountAsync: 'native.fabric.async',
	updateAsync: 'native.fabric.async',
	setSizeAsync: 'native.fabric.async',
	setFrameAsync: 'native.fabric.async',
	measureAsync: 'native.fabric.async',
	unmountAsync: 'native.fabric.async',
};

export const runtimeCapabilities: CapabilityTable<NativeRuntimeBridge> = {
	subscribe: 'native.runtime.events',
};

export const javaCapabilities: CapabilityTable<NativeJavaBridge> = {
	getClass: 'native.java.classes',
	className: 'native.java.classes',
	describe: 'native.java.classes',
	construct: 'native.java.construct',
	respondsTo: 'native.java.classes',
	invoke: 'native.java.invoke',
	invokeAsync: 'native.java.invokeAsync',
	getField: 'native.java.fields',
	setField: 'native.java.fields',
	release: 'native.java.classes',
	batch: 'native.java.batch',
	batchAsync: 'native.java.batch',
	findViews: 'native.java.invoke',
	createAssociationKey: 'native.java.associations',
	getAssociatedObject: 'native.java.associations',
	setAssociatedObject: 'native.java.associations',
};

export const debugCapabilities: CapabilityTable<NativeDebugBridge> = {
	recordEvaluation: 'native.debug.evaluations',
	environment: 'native.debug.environment',
};

export const hooksCapabilities: CapabilityTable<NativeJavaHooksBridge> = {
	hook: 'native.java.hooks',
	setReturnValue: 'native.java.hooks',
	removeReturnValue: 'native.java.hooks',
	clearReturnValues: 'native.java.hooks',
	remove: 'native.java.hooks',
};

/**
 * @description Throws unless a scope declares a capability.
 * @param capabilities The capabilities the scope declares.
 * @param capability The capability an operation needs.
 */
export function requireCapability(
	capabilities: readonly NativePluginCapability[],
	capability: NativePluginCapability,
): void {
	if (!capabilities.includes(capability)) {
		throw new NativePluginCapabilityError(capability);
	}
}

/**
 * @description Wraps a bridge method so it runs only while its scope is active and declares the capability.
 * @template A The method's parameters.
 * @template R The method's return type.
 * @param method The bridge method.
 * @param capabilities The capabilities the scope declares.
 * @param capability The capability the method needs.
 * @param isActive Whether the scope is still active.
 * @returns The gated method.
 */
export function scopedMethod<A extends unknown[], R>(
	method: (...args: A) => R,
	capabilities: readonly NativePluginCapability[],
	capability: NativePluginCapability,
	isActive: () => boolean = () => true,
): (...args: A) => R {
	return (...args: A) => {
		if (!isActive()) {
			throw new NativePluginDisposedError();
		}

		requireCapability(capabilities, capability);

		return method(...args);
	};
}

/**
 * @description Builds a bridge whose every method throws {@link NativePluginUnavailableError}, standing in for namespaces the loader lacks.
 * @returns The unavailable bridge.
 */
export function unavailableNativePlugin(): NativePluginBridge {
	function unavailableMethod(): never {
		throw new NativePluginUnavailableError('The native plugin bridge is unavailable.');
	}

	const unavailableObjC = new Proxy({}, { get: () => unavailableMethod }) as NativeObjCBridge;
	const unavailableFFI = new Proxy({}, { get: () => unavailableMethod }) as NativeFFIBridge;
	const unavailableFabric = new Proxy({}, { get: () => unavailableMethod }) as NativeFabricBridge;
	const unavailableRuntime = new Proxy(
		{},
		{ get: () => unavailableMethod },
	) as NativeRuntimeBridge;
	const unavailableJava = new Proxy({}, { get: () => unavailableMethod }) as NativeJavaBridge;
	const unavailableHooks = new Proxy(
		{},
		{ get: () => unavailableMethod },
	) as NativeJavaHooksBridge;
	const unavailableDebug = new Proxy({}, { get: () => unavailableMethod }) as NativeDebugBridge;

	return {
		apiVersion: '0.0.0',
		abiVersion: '0.0.0',
		capabilities: [],
		objc: unavailableObjC,
		ffi: unavailableFFI,
		fabric: unavailableFabric,
		runtime: unavailableRuntime,
		java: unavailableJava,
		hooks: unavailableHooks,
		debug: unavailableDebug,
	};
}

export default {
	objcCapabilities,
	ffiCapabilities,
	fabricCapabilities,
	runtimeCapabilities,
	javaCapabilities,
	debugCapabilities,
	hooksCapabilities,
	requireCapability,
	scopedMethod,
	unavailableNativePlugin,
};
