import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';

import { PLUGIN_NAME } from '~/constants';
import { ReadStateStore } from '~/modules';

const MISSING_READ_STATE = 'ReadStateStore.getOldestUnreadMessageId is not a function';

let reported = false;

function hasOldestUnreadMessageId(): boolean {
	try {
		return typeof ReadStateStore.getOldestUnreadMessageId === 'function';
	} catch {
		return false;
	}
}

/**
 * @description Checks that Discord's read state can name a channel's oldest unread message, logging and recording a skip once when it cannot, so the self test fails instead of passing a plugin that does nothing.
 * @returns Whether the read state can be used.
 */
export function verifyReadState(): boolean {
	if (hasOldestUnreadMessageId()) return true;

	if (!reported) {
		reported = true;
		console.error(`[${PLUGIN_NAME}] Skipped, ${MISSING_READ_STATE}.`);
		recordSkip(MISSING_READ_STATE);
	}

	return false;
}

/**
 * @description Reads the oldest unread message of a channel from Discord's read state.
 * @param channelId The channel.
 * @returns The message id, or nothing when the channel has no unread messages.
 */
export function oldestUnreadMessageId(channelId: string): string | null | undefined {
	return ReadStateStore.getOldestUnreadMessageId?.(channelId);
}

/**
 * @description Lets a later start report a missing read state again.
 */
export function resetReadStateReport(): void {
	reported = false;
}
