import { storage } from '@unbound-app/api';

const KEY = 'lastChannelId';

/**
 * @description Reads the channel the user last had open.
 * @returns Its id, or `undefined` before one was saved.
 */
export function readLastChannel(): string | undefined {
	return storage.getBucket().get(KEY, '') || undefined;
}

/**
 * @description Saves the channel the user has open.
 * @param channelId The channel's id.
 */
export function saveLastChannel(channelId: string): void {
	storage.getBucket().set(KEY, channelId);
}
