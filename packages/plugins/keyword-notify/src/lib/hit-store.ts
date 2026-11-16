import { storage } from '@unbound-app/api';

import { parseSavedHits, type SavedHit } from '~/lib/saved-hits';

const KEY = 'inboxHits';

const bucket = storage.getBucket();

/**
 * @description Reads the keyword hits saved for the mentions inbox.
 * @returns The hits, newest first.
 */
export function getSavedHits(): SavedHit[] {
	return parseSavedHits(bucket.get(KEY, []));
}

/**
 * @description Saves the keyword hits for the mentions inbox.
 * @param list The hits.
 */
export function saveHits(list: SavedHit[]): void {
	bucket.set(KEY, list);
}

export default { getSavedHits, saveHits };
