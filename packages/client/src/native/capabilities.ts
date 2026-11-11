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
	NativeUIBridge,
} from '@unbound-app/types';
import { NATIVE_PLUGIN_CAPABILITIES } from '@unbound-app/types/native';

import {
	NativePluginCapabilityError,
	NativePluginUnavailableError,
	NativePluginVersionError,
} from '~/native/errors';
import { getNativeBridge, requireNativeBridge } from '~/native/bridge';
import { compareVersions } from '~/core/versions';

/**
 * @description Throws unless the native bridge grants every capability and meets the API version.
 * @param capabilities The capabilities the plugin declares.
 * @param minimumApi The lowest native bridge API version the plugin supports.
 */
export function validateNativeBridgeRequirements(
	capabilities: readonly NativePluginCapability[] = [],
	minimumApi?: string,
): void {
	const bridge = getNativeBridge();
	const invalidCapability = capabilities.find(
		(capability) => !NATIVE_PLUGIN_CAPABILITIES.includes(capability),
	);

	if (invalidCapability) {
		throw new NativePluginCapabilityError(invalidCapability);
	}

	if ((capabilities.length > 0 || minimumApi) && !bridge) {
		requireNativeBridge();
	}

	if (!bridge) return;

	const unknown = capabilities.find((capability) => !bridge.capabilities.includes(capability));

	if (unknown) {
		throw new NativePluginCapabilityError(unknown);
	}

	if (minimumApi && compareVersions(bridge.apiVersion, minimumApi) < 0) {
		throw new NativePluginVersionError(minimumApi, bridge.apiVersion);
	}
}

/**
 * @description Checks whether the native bridge on this device provides a capability, so an addon can
 * fall back when the other platform lacks it.
 * @param capability The capability to look for.
 * @returns Whether the bridge provides it.
 */
export function has(capability: NativePluginCapability): boolean {
	return Boolean(getNativeBridge()?.capabilities.includes(capability));
}

/**
 * @description Checks whether the loader on this device implements a bridge method, for methods newer than the capability that gates them.
 * @param method The method's path, such as `fabric.batchAsync`.
 * @returns Whether the loader implements it.
 */
export function supports(method: NativePluginMethod): boolean {
	const [namespace = '', name = ''] = method.split('.');

	// The client implements `runtime` over Flux, so no loader lacks it.
	if (namespace === 'runtime') {
		return true;
	}

	const bridge = getNativeBridge();
	const source: unknown = bridge && Reflect.get(bridge, namespace);

	return (
		typeof source === 'object' &&
		source !== null &&
		typeof Reflect.get(source, name) === 'function'
	);
}

/**
 * @description Builds a bridge whose every method throws {@link NativePluginUnavailableError}, standing in for namespaces the loader lacks.
 * @returns The unavailable bridge.
 */
export function unavailableNativeBridge(): NativePluginBridge {
	function unavailableMethod(): never {
		throw new NativePluginUnavailableError('The native bridge is unavailable.');
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
