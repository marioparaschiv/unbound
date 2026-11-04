import { definePlatform } from '@unbound-app/api/native';

import { createTagGradients as androidGradients } from '~/tags/android/tag-gradients';
import { createTagGradients as iosGradients } from '~/tags/ios/tag-gradient-renderer';
import { toRendererColor as androidColor } from '~/tags/android/renderer-color';
import { toRendererColor as iosColor } from '~/tags/ios/renderer-color';

export const createTagGradients = definePlatform({
	ios: iosGradients,
	android: androidGradients,
});

export const toRendererColor = definePlatform({ ios: iosColor, android: androidColor });
