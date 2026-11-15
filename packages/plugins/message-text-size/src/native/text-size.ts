import { native } from '@unbound-app/api';

import { messageTextSizeAndroid as android } from '~/native/android/text-size';

/** A running text size: change its factor, or give messages their size back. */
export type MessageTextSize = { update(scale: number): void; dispose(): void };

/**
 * @description Scales the text of chat messages; Android only, where message text is a text view of its own.
 */
export const messageTextSize = native.definePlatform({ android });
