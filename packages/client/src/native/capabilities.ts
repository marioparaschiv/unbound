import type {
	NativeDebugBridge,
	NativeFabricBridge,
	NativeFFIBridge,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeObjCBridge,
	NativePluginBridge,
	NativePluginCapability,
	NativePluginMethod,
	NativeRuntimeBridge,
} from '@unbound-app/types';
import {
	NATIVE_PLUGIN_CAPABILITIES,
	NATIVE_PLUGIN_METHOD_CAPABILITIES,
} from '@unbound-app/types/native';

import {
	NativePluginCapabilityError,
	NativePluginDisposedError,
	NativePluginUnavailableError,
	NativePluginVersionError,
} from '~/native/errors';
import { getNativePlugin, requireNativePlugin } from '~/native/plugin-bridge';
import { compareVersions } from '~/core/versions';

/**
 * @description Throws unless a scope declares the capability a bridge method needs.
 * @param capabilities The capabilities the scope declares.
 * @param method The bridge method, such as `objc.invoke`.
 */
export function requireCapability(
	capabilities: readonly NativePluginCapability[],
	method: NativePluginMethod,
): void {
	const capability = NATIVE_PLUGIN_METHOD_CAPABILITIES[method];

	if (!capabilities.includes(capability)) {
		throw new NativePluginCapabilityError(capability);
	}
}

/**
 * @description Throws unless the native plugin bridge grants every capability and meets the API version.
 * @param capabilities The capabilities the plugin declares.
 * @param minimumApi The lowest native plugin API version the plugin supports.
 */
export function validateNativePluginRequirements(
	capabilities: readonly NativePluginCapability[] = [],
	minimumApi?: string,
): void {
	const nativePlugin = getNativePlugin();
	const invalidCapability = capabilities.find(
		(capability) => !NATIVE_PLUGIN_CAPABILITIES.includes(capability),
	);

	if (invalidCapability) {
		throw new NativePluginCapabilityError(invalidCapability);
	}

	if ((capabilities.length > 0 || minimumApi) && !nativePlugin) {
		requireNativePlugin();
	}

	if (!nativePlugin) return;

	const unknown = capabilities.find(
		(capability) => !nativePlugin.capabilities.includes(capability),
	);

	if (unknown) {
		throw new NativePluginCapabilityError(unknown);
	}

	if (minimumApi && compareVersions(nativePlugin.apiVersion, minimumApi) < 0) {
		throw new NativePluginVersionError(minimumApi, nativePlugin.apiVersion);
	}
}

/**
 * @description Wraps a bridge method so it runs only while its scope is active and declares the method's capability.
 * @template A The method's parameters.
 * @template R The method's return type.
 * @param method The bridge method.
 * @param capabilities The capabilities the scope declares.
 * @param path The method's path, such as `objc.invoke`.
 * @param isActive Whether the scope is still active.
 * @returns The gated method.
 */
export function scopedMethod<A extends unknown[], R>(
	method: (...args: A) => R,
	capabilities: readonly NativePluginCapability[],
	path: NativePluginMethod,
	isActive: () => boolean = () => true,
): (...args: A) => R {
	return (...args: A) => {
		if (!isActive()) {
			throw new NativePluginDisposedError();
		}

		requireCapability(capabilities, path);

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
	requireCapability,
	validateNativePluginRequirements,
	scopedMethod,
	unavailableNativePlugin,
};
