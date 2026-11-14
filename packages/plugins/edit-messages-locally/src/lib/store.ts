import { storage } from '@unbound-app/api';

import { parseEdits, type Edits } from '~/lib/edits';

const KEY = 'edits';

const bucket = storage.getBucket();

/**
 * @description Reads every local edit.
 * @returns The edits, by message id.
 */
export function getEdits(): Edits {
	return parseEdits(bucket.get(KEY, {}));
}

/**
 * @description Saves every local edit.
 * @param edits The edits, by message id.
 */
export function saveEdits(edits: Edits): void {
	bucket.set(KEY, edits);
}
