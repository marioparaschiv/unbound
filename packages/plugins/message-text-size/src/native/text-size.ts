import { native } from '@unbound-app/api';

import { messageTextSizeAndroid as android } from '~/native/android/text-size';
import { messageTextSizeIOS as ios } from '~/native/ios/text-size';

export type MessageTextSize = { update(scale: number): void; dispose(): void };

/**
 * @description Scales the text of chat messages: Android resizes each message's text view, iOS scales the text before
 * YYText lays it out.
 */
export const messageTextSize = native.definePlatform({ ios, android });
