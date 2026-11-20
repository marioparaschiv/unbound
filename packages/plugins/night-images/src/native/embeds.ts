import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { dimAndroidEmbeds } from '~/native/android/embeds';
import { dimIosEmbeds } from '~/native/ios/embeds';

/** Dims bright embed images on iOS; Android leaves them as they are. */
export const dimEmbeds = native.definePlatform<(bridge: NativeBridge) => () => Promise<void>>({
	ios: dimIosEmbeds,
	android: dimAndroidEmbeds,
});
