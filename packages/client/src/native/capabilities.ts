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
	NativeUIBridge,
} from '@unbound-app/types';
import { NATIVE_PLUGIN_CAPABILITIES } from '@unbound-app/types/native';

import {
	NativePluginCapabilityError,
	NativePluginUnavailableError,
	NativePluginVersionError,
} from '~/native/errors';
import { getNativePlugin, requireNativePlugin } from '~/native/plugin-bridge';
import { compareVersions } from '~/core/versions';

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
 * @description Checks whether the native bridge on this device provides a capability, so an addon can
 * fall back when the other platform lacks it.
 * @param capability The capability to look for.
 * @returns Whether the bridge provides it.
 */
export function has(capability: NativePluginCapability): boolean {
	return Boolean(getNativePlugin()?.capabilities.includes(capability));
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
	const unavailableUI = new Proxy({}, { get: () => unavailableMethod }) as NativeUIBridge;

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
		ui: unavailableUI,
	};
}
