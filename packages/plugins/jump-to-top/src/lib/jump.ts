import { metro } from '@unbound-app/api';

import { findFirstMessageId } from '~/lib/first-message';

const BEFORE_EVERY_MESSAGE = '0';

function jumpTo(channelId: string, messageId: string): void {
	metro.api.Messages.jumpToMessage({ channelId, messageId, flash: false, jumpType: 'INSTANT' });
}

/**
 * @description Scrolls a channel to its first message, or to Discord's oldest page when the lookup fails.
 * @param channelId The channel to scroll.
 */
export async function jumpToTop(channelId: string): Promise<void> {
	try {
		jumpTo(channelId, (await findFirstMessageId(channelId)) ?? BEFORE_EVERY_MESSAGE);
	} catch (error) {
		logger.error(`Failed to find the first message in ${channelId}:`, error);
		jumpTo(channelId, BEFORE_EVERY_MESSAGE);
	}
}
