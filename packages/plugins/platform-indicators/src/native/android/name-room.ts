import type { NativeBridge } from '@unbound-app/api/native';

/**
 * @description Leaves Android's message headers as Discord lays them out.
 * @param _native The plugin's native bridge.
 * @returns A function that does nothing.
 */
export function keepAndroidNameRoom(_native: NativeBridge): () => void {
	return () => undefined;
}

export default keepAndroidNameRoom;
