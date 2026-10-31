import { native } from '@unbound-app/api';

import { createTagGradients as androidGradients } from '~/android/tag-gradients';
import { createTagGradients as iosGradients } from '~/ios/tag-gradient-renderer';
import { toRendererColor as androidColor } from '~/android/renderer-color';
import { toRendererColor as iosColor } from '~/ios/renderer-color';

export const createTagGradients = native.definePlatform({
	ios: iosGradients,
	android: androidGradients,
});

export const toRendererColor = native.definePlatform({ ios: iosColor, android: androidColor });
