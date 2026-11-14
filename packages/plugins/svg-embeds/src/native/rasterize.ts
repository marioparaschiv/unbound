import { native } from '@unbound-app/api';

import { rasterizeSvgAndroid as android } from '~/native/android/rasterize';
import { rasterizeSvgIOS as ios } from '~/native/ios/rasterize';

/**
 * @description Draws an SVG file as a PNG with the platform's own renderer: CoreSVG on iOS, a web view on Android.
 */
export const rasterizeSvg = native.definePlatform({ ios, android });
