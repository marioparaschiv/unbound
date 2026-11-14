import { native } from '@unbound-app/api';

import { liveMarkdownIOS as ios } from '~/native/ios/live-markdown';

/**
 * @description Draws markdown in Discord's composer as it is typed; iOS only for now.
 */
export const liveMarkdown = native.definePlatform({ ios });
