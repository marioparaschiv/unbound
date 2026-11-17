import type { NativeBridge } from '@unbound-app/api/native';

/**
 * @description Media mosaics aren't restacked on iOS yet.
 * @param _native The plugin's native bridge.
 * @returns A function that does nothing.
 */
export function stackIOS(_native: NativeBridge) {
	return async () => undefined;
}
