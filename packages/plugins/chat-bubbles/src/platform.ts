import { native } from '@unbound-app/api';

import { drawAndroidBubbles as android } from '~/android/bubbles';
import { drawIOSBubbles as ios } from '~/ios/bubbles';

export const drawBubbles = native.definePlatform({ ios, android });
