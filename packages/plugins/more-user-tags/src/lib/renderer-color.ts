import { definePlatform } from '@unbound-app/api/native';

import { toRendererColor as android } from '~/lib/android/renderer-color';
import { toRendererColor as ios } from '~/lib/ios/renderer-color';

export const toRendererColor = definePlatform({ ios, android });
