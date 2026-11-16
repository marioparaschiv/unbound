import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { cutOut as android } from '~/native/android/cut-out';
import { cutOut as ios } from '~/native/ios/cut-out';

const cutOutOnPlatform = native.definePlatform({ ios, android });

/**
 * @description Cuts the subject out of an image: Vision's subject lifting on iOS, plain backgrounds on Android.
 * @param bridge The plugin's native bridge.
 * @param path The image's absolute path.
 * @returns The cutout as a base64 PNG, or `undefined` when no subject could be cut out.
 */
export function cutOutImage(bridge: NativeBridge, path: string): string | undefined {
	return cutOutOnPlatform(bridge, path) ?? undefined;
}

export default { cutOutImage };
