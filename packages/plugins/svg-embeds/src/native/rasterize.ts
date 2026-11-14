import { native } from '@unbound-app/api';

import { rasterizeSvgIOS as ios } from '~/native/ios/rasterize';

/**
 * @description Draws an SVG file as a PNG with the platform's own renderer; iOS only for now.
 */
export const rasterizeSvg = native.definePlatform({ ios });
