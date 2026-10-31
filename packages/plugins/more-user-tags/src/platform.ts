import { native } from '@unbound-app/api';

import { createTagGradients as androidGradients } from '~/android/tag-gradients';
import { createTagGradients as iosGradients } from '~/ios/tag-gradient-renderer';
import { toRendererColor as androidColor } from '~/android/renderer-color';
import { toRendererColor as iosColor } from '~/ios/renderer-color';

/** Draws role-color gradients behind Discord's native message tags. */
export const createTagGradients = native.definePlatform({
	ios: iosGradients,
	android: androidGradients,
});

/** Converts a `processColor` result into the form the platform's tag renderer accepts. */
export const toRendererColor = native.definePlatform({ ios: iosColor, android: androidColor });
