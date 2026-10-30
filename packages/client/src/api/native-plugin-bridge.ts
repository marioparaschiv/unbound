import type { NativePluginRuntimeBridge } from '@unbound-app/types';

import { NativePluginUnavailableError } from '~/api/native-errors';

type NativePluginRuntimeGlobal = typeof globalThis & { NativePlugin?: NativePluginRuntimeBridge };

const nativePluginGlobal = globalThis as NativePluginRuntimeGlobal;
const nativePluginBridge = nativePluginGlobal.NativePlugin;

// Plugins only ever reach the bridge through a scope limited to the capabilities they declare.
delete nativePluginGlobal.NativePlugin;

/**
 * @description Returns the raw native plugin bridge the loader installed, captured before plugins run.
 * @returns The bridge, or `undefined` when the loader has none.
 */
export function getNativePlugin(): NativePluginRuntimeBridge | undefined {
	return nativePluginBridge;
}

/**
 * @description Returns the raw native plugin bridge, throwing when the loader has none.
 * @returns The bridge.
 */
export function requireNativePlugin(): NativePluginRuntimeBridge {
	if (!nativePluginBridge) {
		throw new NativePluginUnavailableError('The native plugin bridge is unavailable.');
	}

	return nativePluginBridge;
}

export default { getNativePlugin, requireNativePlugin };
