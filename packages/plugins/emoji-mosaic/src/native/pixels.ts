import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { readPixels as android } from '~/native/android/pixels';
import { readPixels as ios } from '~/native/ios/pixels';

const readPlatformPixels = native.definePlatform({ ios, android });

/**
 * @description Decodes an image file into RGBA pixels scaled to a size, with the platform's image decoder.
 * @param bridge The plugin's native bridge.
 * @param path The image's absolute path.
 * @param width The width to scale to.
 * @param height The height to scale to.
 * @returns The RGBA pixels, or `undefined` when the image can't be read.
 */
export function readImagePixels(
	bridge: NativeBridge,
	path: string,
	width: number,
	height: number,
): Uint8Array | undefined {
	return readPlatformPixels(bridge, path, width, height) ?? undefined;
}
