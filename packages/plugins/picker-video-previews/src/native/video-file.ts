import { native } from '@unbound-app/api';

import { videoFileAndroid as android } from '~/native/android/video-file';
import { videoFileIOS as ios } from '~/native/ios/video-file';

/**
 * @description Finds a playable file URL for a media picker video.
 */
export const videoFile = native.definePlatform({ ios, android });
