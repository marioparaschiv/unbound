import type { NativeBridge } from '@unbound-app/api/native';

/**
 * @description Discord's iOS sounds are plain bundle files, so every one of them plays.
 * @param _native The plugin's native bridge.
 * @returns A check that accepts every sound name.
 */
export function playableSoundIOS(_native: NativeBridge): (name: string) => boolean {
	return () => true;
}

export default playableSoundIOS;
