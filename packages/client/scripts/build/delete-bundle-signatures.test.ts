import { describe, expect, test } from 'bun:test';

import type { SignatureBucket } from './delete-bundle-signatures';

import { deleteBundleSignatures, isBundleSignatureKey } from './delete-bundle-signatures';

function bucketWith(keys: string[]) {
	const objects = new Set(keys);
	const bucket: SignatureBucket = {
		list: async () => ({ contents: [...objects].map((key) => ({ key })), isTruncated: false }),
		delete: async (key: string) => void objects.delete(key),
	};

	return { bucket, objects };
}

const KEYS = [
	'unbound/stable/1.0.0/unbound.js',
	'unbound/stable/1.0.0/unbound.js.sig',
	'unbound/stable/1.0.0/unbound.98.bundle',
	'unbound/stable/1.0.0/unbound.98.bundle.sig',
	'unbound/stable/1.0.0/manifest.json',
	'unbound/stable/1.0.0/manifest.json.sig',
	'unbound/pr/12/unbound.96.bundle.sig',
	'unbound/beta/abc/unbound.98.bundle.map',
];

describe('delete-bundle-signatures', () => {
	test('matches per-bundle signatures only, never the signed manifest', () => {
		expect(KEYS.filter(isBundleSignatureKey)).toEqual([
			'unbound/stable/1.0.0/unbound.js.sig',
			'unbound/stable/1.0.0/unbound.98.bundle.sig',
			'unbound/pr/12/unbound.96.bundle.sig',
		]);
		expect(isBundleSignatureKey('unbound/x/other.js.sig')).toBe(false);
	});

	test('lists them in a dry run and deletes only them when asked', async () => {
		const { bucket, objects } = bucketWith(KEYS);

		expect(await deleteBundleSignatures(bucket, false)).toHaveLength(3);
		expect(objects.size).toBe(KEYS.length);

		await deleteBundleSignatures(bucket, true);

		expect([...objects]).toEqual([
			'unbound/stable/1.0.0/unbound.js',
			'unbound/stable/1.0.0/unbound.98.bundle',
			'unbound/stable/1.0.0/manifest.json',
			'unbound/stable/1.0.0/manifest.json.sig',
			'unbound/beta/abc/unbound.98.bundle.map',
		]);
	});
});
