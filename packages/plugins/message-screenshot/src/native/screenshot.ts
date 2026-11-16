import { native } from '@unbound-app/api';

import { screenshotAndroid as android } from '~/native/android/screenshot';
import { screenshotIOS as ios } from '~/native/ios/screenshot';

export type ScreenshotOutput = 'share' | 'copy';

export type ScreenshotResult = 'done' | 'not-visible';

/**
 * @description Captures the on-screen rows of some messages as one picture, then shares or copies it.
 */
export const screenshotMessages = native.definePlatform({ ios, android });
