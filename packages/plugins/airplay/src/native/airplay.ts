import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { createAirPlay as ios, type AirPlay } from '~/native/ios/airplay';

const createPlatformAirPlay = native.definePlatform({ ios });

/**
 * @description Creates the AirPlay controller on iOS, where AirPlay exists.
 * @param bridge The plugin's native bridge.
 * @returns The controller, or `undefined` on other platforms.
 */
export function createAirPlay(bridge: NativeBridge): AirPlay | undefined {
	return createPlatformAirPlay(bridge) ?? undefined;
}
