import { definePlatform } from '@unbound-app/api/native';

import { toRendererColor as android } from '~/lib/renderer-color-android';
import { toRendererColor as ios } from '~/lib/renderer-color-ios';

export const toRendererColor = definePlatform({ ios, android });
