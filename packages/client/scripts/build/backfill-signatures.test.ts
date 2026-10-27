import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, test } from 'bun:test';

import type { BackfillBucket } from './backfill-signatures';

import { backfillSignatures, isBundleKey } from './backfill-signatures';

function createMemoryBucket(initial: Record<string, string>) {
	const objects = new Map(Object.entries(initial));
	const writes: string[] = [];

	const bucket: BackfillBucket = {
		async write(key, data) {
			if (objects.has(key)) {
				throw new Error(`${key} was overwritten`);
			}

			objects.set(key, await new Response(data as BodyInit).text());
			writes.push(key);

			return 0;
		},
		async delete(key) {
			objects.delete(key);
		},
		async exists(key) {
			return objects.has(key);
		},
		async list(input) {
			const keys = [...objects.keys()]
				.filter((key) => key.startsWith(input?.prefix ?? ''))
				.toSorted();

			return {
				keyCount: keys.length,
				contents: keys.map((key) => ({ key })),
				isTruncated: false,
			};
		},
		file(key) {
			return { arrayBuffer: async () => new TextEncoder().encode(objects.get(key)).buffer };
		},
	};

	return { bucket, objects, writes };
}

describe('isBundleKey', () => {
	test('matches the bundles the loader downloads', () => {
		expect(isBundleKey('unbound/stable/1.0.0/unbound.js')).toBe(true);
		expect(isBundleKey('unbound/stable/1.0.0/unbound.96.bundle')).toBe(true);
		expect(isBundleKey('unbound/stable/1.0.0/unbound.96.bundle.sig')).toBe(false);
		expect(isBundleKey('unbound/stable/1.0.0/manifest.json')).toBe(false);
		expect(isBundleKey('unbound/stable/1.0.0/i18n/unbound.js.json')).toBe(false);
	});
});

describe('backfillSignatures', () => {
	test('writes only missing signatures, in the stable and beta channels', async () => {
		const { privateKey, publicKey } = generateKeyPairSync('ed25519');
		const { bucket, objects, writes } = createMemoryBucket({
			'unbound/stable/1.0.0/unbound.js': 'stable',
			'unbound/beta/abc1234/unbound.96.bundle': 'beta',
			'unbound/beta/abc1234/unbound.96.bundle.sig': 'kept',
			'unbound/pr/42/unbound.js': 'pull request',
		});

		const result = await backfillSignatures(bucket, privateKey);

		expect(writes).toEqual(['unbound/stable/1.0.0/unbound.js.sig']);
		expect(result.alreadySigned).toEqual(['unbound/beta/abc1234/unbound.96.bundle']);
		expect(objects.get('unbound/beta/abc1234/unbound.96.bundle.sig')).toBe('kept');

		const signature = Buffer.from(
			objects.get('unbound/stable/1.0.0/unbound.js.sig')!.trim(),
			'base64',
		);

		expect(verify(null, Buffer.from('stable'), publicKey, signature)).toBe(true);
	});
});
