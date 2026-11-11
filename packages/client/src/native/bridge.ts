import type { LoaderNativeBridge } from '@unbound-app/types';

import { NativeBridgeUnavailableError } from '~/native/errors';

type NativeBridgeGlobal = typeof globalThis & { NativePlugin?: LoaderNativeBridge };

const loaderGlobal = globalThis as NativeBridgeGlobal;
const nativeBridge = loaderGlobal.NativePlugin;

// Plugins only ever reach the bridge through a scope limited to the capabilities they declare.
delete loaderGlobal.NativePlugin;

/**
 * @description Returns the raw native bridge the loader installed, captured before plugins run.
 * @returns The bridge, or `undefined` when the loader has none.
 */
export function getNativeBridge(): LoaderNativeBridge | undefined {
	return nativeBridge;
}

/**
 * @description Returns the raw native bridge, throwing when the loader has none.
 * @returns The bridge.
 */
export function requireNativeBridge(): LoaderNativeBridge {
	if (!nativeBridge) {
		throw new NativeBridgeUnavailableError('The native bridge is unavailable.');
	}

	return nativeBridge;
}
