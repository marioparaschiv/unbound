import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { createSegmentPlayer as android } from '~/native/android/segment-player';
import { createSegmentPlayer as ios } from '~/native/ios/segment-player';

export type SegmentPlayer = {
	playFrom(seconds: number): Promise<boolean>;
	stop(): Promise<void>;
};

const createPlatformPlayer = native.definePlatform({ ios, android });

/**
 * @description Creates a player that plays a transcript's audio from a passage, on iOS, where speech recognition times
 * each word; Android's recogniser does not, so it has none.
 * @param bridge The plugin's native bridge.
 * @param path The downloaded audio's path.
 * @returns The player, or `undefined` on Android.
 */
export function createSegmentPlayer(bridge: NativeBridge, path: string): SegmentPlayer | undefined {
	return createPlatformPlayer(bridge, path) ?? undefined;
}

export default { createSegmentPlayer };
