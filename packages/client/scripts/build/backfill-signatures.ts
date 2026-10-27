import { createLogger } from '@unbound-app/logger';
import { sign, type KeyObject } from 'node:crypto';
import { posix } from 'node:path';

import type { PublicBucket } from './upload';

import { parseSigningKey, SIGNATURE_SUFFIX, SIGNING_KEY_VARIABLE } from './sign';
import { createPublicBucket, listKeys, parseBucketEnv } from './upload';

const logger = createLogger('Build', 'Backfill');

export const BACKFILL_CHANNELS = ['stable', 'beta'] as const;

export type StoredObject = { arrayBuffer(): Promise<ArrayBuffer> };

export type BackfillBucket = PublicBucket & { file(key: string): StoredObject };

export type BackfillResult = {
	signed: string[];
	alreadySigned: string[];
};

/**
 * @description Whether an object key names a client bundle the loader downloads.
 * @param key The object key.
 * @returns `true` for `unbound.js` and `unbound.<bytecode>.bundle`.
 */
export function isBundleKey(key: string): boolean {
	const name = posix.basename(key);

	return name === 'unbound.js' || (name.startsWith('unbound.') && name.endsWith('.bundle'));
}

/**
 * @description Signs every published release bundle that has no signature yet, writing only the new `.sig` objects.
 * @param bucket The public bucket.
 * @param key The production Ed25519 signing key.
 * @param channels The channels to backfill.
 * @returns The signatures written and the bundles that already had one.
 */
export async function backfillSignatures(
	bucket: BackfillBucket,
	key: KeyObject,
	channels: readonly string[] = BACKFILL_CHANNELS,
): Promise<BackfillResult> {
	const result: BackfillResult = { signed: [], alreadySigned: [] };

	for (const channel of channels) {
		const keys = await listKeys(bucket, `unbound/${channel}/`);
		const existing = new Set(keys);

		for (const bundle of keys.filter(isBundleKey)) {
			const signatureKey = `${bundle}${SIGNATURE_SUFFIX}`;

			if (existing.has(signatureKey) || (await bucket.exists(signatureKey))) {
				result.alreadySigned.push(bundle);
				continue;
			}

			const bytes = Buffer.from(await bucket.file(bundle).arrayBuffer());
			const signature = sign(null, bytes, key).toString('base64');

			await bucket.write(signatureKey, `${signature}\n`, { type: 'text/plain' });
			result.signed.push(signatureKey);
		}
	}

	return result;
}

if (import.meta.main) {
	const pem = process.env[SIGNING_KEY_VARIABLE];

	if (!pem?.trim()) {
		throw new Error(`${SIGNING_KEY_VARIABLE} is required to backfill signatures.`);
	}

	const bucket = createPublicBucket(parseBucketEnv());
	const { signed, alreadySigned } = await backfillSignatures(bucket, parseSigningKey(pem));

	for (const key of signed) logger.info(`Wrote ${key}`);

	logger.success(
		`Signed ${signed.length} bundles; ${alreadySigned.length} already had a signature.`,
	);
}
