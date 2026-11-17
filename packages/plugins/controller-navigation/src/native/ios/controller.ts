import type { NativeBridge } from '@unbound-app/api/native';

/**
 * @description Game controllers aren't read on iOS yet.
 * @param _native The plugin's native bridge.
 * @param _onPress Unused.
 * @returns A function that does nothing.
 */
export function listenIOS(_native: NativeBridge, _onPress: (code: number) => void) {
	return () => undefined;
}
