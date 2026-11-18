import { native } from '@unbound-app/api';

import { askForLibrary, canReadLibrary, fileNewestAsset } from '~/native/ios/album';

export const canRead = native.definePlatform({ ios: canReadLibrary });
export const askToRead = native.definePlatform({ ios: askForLibrary });
export const fileNewest = native.definePlatform({ ios: fileNewestAsset });
