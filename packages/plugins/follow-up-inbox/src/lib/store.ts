import { storage } from '@unbound-app/api';

import { parseFollowUps, type FollowUp } from '~/lib/follow-ups';

const KEY = 'followUps';

const bucket = storage.getBucket();

/**
 * @description Reads the saved follow-ups.
 * @returns The follow-ups, newest first.
 */
export function getFollowUps(): FollowUp[] {
	return parseFollowUps(bucket.get(KEY, []));
}

/**
 * @description Saves the follow-ups.
 * @param list The follow-ups.
 */
export function saveFollowUps(list: FollowUp[]): void {
	bucket.set(KEY, list);
}

/**
 * @description Reads the follow-ups and re-renders the component when they change.
 * @returns The follow-ups, newest first.
 */
export function useFollowUps(): FollowUp[] {
	storage.useBucket(addon.id);

	return getFollowUps();
}

export default { getFollowUps, saveFollowUps, useFollowUps };
