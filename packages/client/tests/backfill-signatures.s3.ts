import { afterAll, describe, expect, test } from 'bun:test';
import { generateKeyPairSync, verify } from 'node:crypto';

import { createPublicBucket, parseBucketEnv } from '../scripts/build/upload';
import { backfillSignatures } from '../scripts/build/backfill-signatures';

const bucket = createPublicBucket(parseBucketEnv());
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const run = crypto.randomUUID().replaceAll('-', '');
const channels = [`backfill-stable-${run}`, `backfill-beta-${run}`];
const stable = `unbound/${channels[0]}/1.0.0/`;
const beta = `unbound/${channels[1]}/abc1234/`;

await bucket.write(`${stable}manifest.json`, '{"bytecodeVersions":[96]}');
await bucket.write(`${stable}unbound.js`, 'stable javascript');
await bucket.write(`${stable}unbound.96.bundle`, new Uint8Array([0xc6, 0x1f, 0xbc, 0x03]));
await bucket.write(`${beta}manifest.json`, '{"bytecodeVersions":[96]}');
await bucket.write(`${beta}unbound.96.bundle`, 'already signed bundle');
await bucket.write(`${beta}unbound.96.bundle.sig`, 'kept\n');

afterAll(async () => {
	for (const channel of channels) {
		const { contents = [] } = await bucket.list({ prefix: `unbound/${channel}/` });

		await Promise.all(contents.map((object) => bucket.delete(object.key)));
	}
});

describe('backfillSignatures', () => {
	test('signs only the unsigned bundles and never touches existing objects', async () => {
		const result = await backfillSignatures(bucket, privateKey, channels);

		expect(result.signed.toSorted()).toEqual([
			`${stable}unbound.96.bundle.sig`,
			`${stable}unbound.js.sig`,
		]);
		expect(result.alreadySigned).toEqual([`${beta}unbound.96.bundle`]);
		expect(await bucket.exists(`${stable}manifest.json.sig`)).toBe(false);
		expect(await bucket.file(`${beta}unbound.96.bundle.sig`).text()).toBe('kept\n');
		expect(await bucket.file(`${stable}manifest.json`).text()).toBe(
			'{"bytecodeVersions":[96]}',
		);

		for (const file of ['unbound.js', 'unbound.96.bundle']) {
			const bytes = Buffer.from(await bucket.file(`${stable}${file}`).arrayBuffer());
			const signature = Buffer.from(
				(await bucket.file(`${stable}${file}.sig`).text()).trim(),
				'base64',
			);

			expect(verify(null, bytes, publicKey, signature)).toBe(true);
		}
	});

	test('does nothing on a second run', async () => {
		const result = await backfillSignatures(bucket, privateKey, channels);

		expect(result.signed).toEqual([]);
		expect(result.alreadySigned).toHaveLength(3);
	});
});
