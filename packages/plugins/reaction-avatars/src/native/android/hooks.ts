import type { NativeBridge } from '@unbound-app/api/native';

import { createAndroidReactions } from '~/native/android/reactions';

let reactions: ReturnType<typeof createAndroidReactions> | undefined;

/**
 * @description Starts drawing avatars beside Discord's Android reaction pills.
 * @param native The plugin's native bridge.
 * @param surfaceName The registered avatar surface.
 */
export function hookReactions(native: NativeBridge, surfaceName: string): void {
	reactions = createAndroidReactions(native, surfaceName);
}

/**
 * @description Removes the Android reaction hooks and the avatars they drew, which the Addon scope cannot see.
 */
export function unhookReactions(): void {
	reactions?.dispose();
	reactions = undefined;
}
