import { storage } from '@unbound-app/api';

import { parsePinned } from '~/lib/shortcuts';

const KEY = 'pinned';

const bucket = storage.getBucket();

/**
 * @description Reads the pinned shortcut ids.
 * @returns The ids, in pinned order.
 */
export function getPinned(): string[] {
	return parsePinned(bucket.get(KEY, []));
}

/**
 * @description Saves the pinned shortcut ids.
 * @param ids The ids, in pinned order.
 */
export function savePinned(ids: string[]): void {
	bucket.set(KEY, ids);
}

/**
 * @description Reads the pinned shortcut ids and re-renders the component when they change.
 * @returns The ids, in pinned order.
 */
export function usePinned(): string[] {
	storage.useBucket(addon.id);

	return getPinned();
}

export default { getPinned, savePinned, usePinned };
