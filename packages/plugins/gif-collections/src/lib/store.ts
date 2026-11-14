import { storage } from '@unbound-app/api';

import { parseCollections, type Collection } from '~/lib/collections';

const KEY = 'collections';

const bucket = storage.getBucket();

/**
 * @description Reads the saved collections.
 * @returns The collections, in the order they were created.
 */
export function getCollections(): Collection[] {
	return parseCollections(bucket.get(KEY, []));
}

/**
 * @description Saves the collections.
 * @param collections The collections.
 */
export function saveCollections(collections: Collection[]): void {
	bucket.set(KEY, collections);
}

/**
 * @description Reads the saved collections and re-renders the component when they change.
 * @returns The collections.
 */
export function useCollections(): Collection[] {
	storage.useBucket(addon.id);

	return getCollections();
}
