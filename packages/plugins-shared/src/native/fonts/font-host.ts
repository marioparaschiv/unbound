import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { createFontHost as android } from './android/font-host';
import { createFontHost as ios } from './ios/font-host';

export type FontHost = {
	inflate: (compressed: Uint8Array, length: number) => Uint8Array;
	register: (path: string, family: string) => Promise<string>;
};

const createPlatformHost = native.definePlatform({ ios, android });

/**
 * @description Creates the platform's font loader.
 * @param bridge The plugin's native bridge.
 * @returns The host, or `undefined` on a platform without one.
 */
export function createFontHost(bridge: NativeBridge): FontHost | undefined {
	return createPlatformHost(bridge) ?? undefined;
}
