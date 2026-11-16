import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { readPixels as android } from '~/native/android/pixels';
import { readPixels as ios } from '~/native/ios/pixels';

const readPlatformPixels = native.definePlatform({ ios, android });

/**
 * @description Decodes an image file into square RGBA pixels with the platform's image decoder.
 * @param bridge The plugin's native bridge.
 * @param path The image's absolute path.
 * @param size The square's width and height.
 * @returns The RGBA pixels, or `undefined` when the image can't be read.
 */
export function readSquarePixels(
	bridge: NativeBridge,
	path: string,
	size: number,
): Uint8Array | undefined {
	return readPlatformPixels(bridge, path, size) ?? undefined;
}

export default { readSquarePixels };
