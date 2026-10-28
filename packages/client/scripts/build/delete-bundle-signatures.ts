import { createLogger } from '@unbound-app/logger';
import { posix } from 'node:path';

import type { PublicBucket } from './upload';

import { createPublicBucket, listKeys, parseBucketEnv } from './upload';
import { SIGNATURE_SUFFIX } from './sign';

const logger = createLogger('Build', 'Signatures');

export type SignatureBucket = Pick<PublicBucket, 'list' | 'delete'>;

/** Where client builds live in the public bucket: every channel, version and pull request below it. */
export const CLIENT_PREFIX = 'unbound/';

/**
 * @description Whether an object key is a per-bundle signature, which no loader reads since manifests are signed.
 * @param key The object key.
 * @returns `true` for `unbound.js.sig` and `unbound.<bytecode>.bundle.sig`, never `manifest.json.sig`.
 */
export function isBundleSignatureKey(key: string): boolean {
	if (!key.endsWith(SIGNATURE_SUFFIX)) {
		return false;
	}

	const name = posix.basename(key).slice(0, -SIGNATURE_SUFFIX.length);

	return name === 'unbound.js' || /^unbound\.\d+\.bundle$/.test(name);
}

/**
 * @description Finds every per-bundle signature below the client builds and, unless it is a dry run, deletes them.
 * @param bucket The public bucket.
 * @param remove Whether to delete them, or only list them.
 * @returns The per-bundle signature keys found.
 */
export async function deleteBundleSignatures(
	bucket: SignatureBucket,
	remove: boolean,
): Promise<string[]> {
	const keys = (await listKeys(bucket, CLIENT_PREFIX)).filter(isBundleSignatureKey);

	if (remove) {
		for (const key of keys) {
			await bucket.delete(key);
		}
	}

	return keys;
}

if (import.meta.main) {
	const remove = process.argv.includes('--delete');
	const keys = await deleteBundleSignatures(createPublicBucket(parseBucketEnv()), remove);

	for (const key of keys) {
		logger.info(`${remove ? 'Deleted' : 'Would delete'} ${key}`);
	}

	console.log(
		`${keys.length} per-bundle signature${keys.length === 1 ? '' : 's'} ${remove ? 'deleted' : 'found; pass --delete to remove them'}.`,
	);
}
