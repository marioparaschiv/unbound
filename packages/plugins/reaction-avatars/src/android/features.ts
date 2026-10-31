import type { NativePluginBridge } from '@unbound-app/api/native';

import { createAndroidReactions } from '~/android/reactions';
import type { Feature } from '~/types';

/**
 * @description Starts drawing avatars beside Discord's Android reaction pills.
 * @param native The plugin's native bridge.
 * @param surfaceName The registered avatar surface.
 * @returns The features to apply, in order.
 */
export function reactionFeatures(native: NativePluginBridge, surfaceName: string): Feature[] {
	const reactions = createAndroidReactions(native, surfaceName);

	return [() => reactions.dispose];
}

export default reactionFeatures;
