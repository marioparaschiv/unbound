import { native } from '@unbound-app/api';

import { drawAndroidBubbles as android } from '~/bubbles/android/bubbles';
import { drawIOSBubbles as ios } from '~/bubbles/ios/bubbles';

export const drawBubbles = native.definePlatform({ ios, android });
