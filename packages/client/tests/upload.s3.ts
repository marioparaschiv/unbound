import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	createPublicBucket,
	IncompleteVersionError,
	parseUploadEnv,
	uploadBuild,
	versionPrefix,
} from '../scripts/build/upload';

// Run through `bun scripts/test-s3.ts`, which starts MinIO and provides the S3_* variables.
const env = parseUploadEnv({
	...process.env,
	UNBOUND_CHANNEL: 'beta',
	UNBOUND_VERSION: crypto.randomUUID().replaceAll('-', ''),
});

const bucket = createPublicBucket(env);
const dist = mkdtempSync(join(tmpdir(), 'unbound-dist-'));
const target = { bucket, channel: env.UNBOUND_CHANNEL, version: env.UNBOUND_VERSION };
const prefix = `unbound/${target.channel}/${target.version}/`;

await Bun.write(join(dist, 'unbound.js'), 'first build');
await Bun.write(join(dist, 'unbound.96.bundle'), new Uint8Array([0x1f, 0x19]));
await Bun.write(join(dist, 'unbound.96.bundle.map'), '{"version":3}');
await Bun.write(join(dist, 'manifest.json'), JSON.stringify({ revision: target.version }));

afterAll(async () => {
	const { contents = [] } = await bucket.list({ prefix });

	await Promise.all(contents.map((object) => bucket.delete(object.key)));
	rmSync(dist, { recursive: true, force: true });
});

describe('uploadBuild', () => {
	test('uploads the build under unbound/{channel}/{version}/ with the manifest last', async () => {
		const keys = await uploadBuild(dist, target);

		expect(keys?.toSorted()).toEqual(
			['manifest.json', 'unbound.96.bundle', 'unbound.js'].map((file) => `${prefix}${file}`),
		);
		expect(keys?.at(-1)).toBe(`${prefix}manifest.json`);
		expect(await bucket.file(`${prefix}unbound.js`).text()).toBe('first build');
	});

	test('skips a published version instead of overwriting it', async () => {
		await Bun.write(join(dist, 'unbound.js'), 'second build');

		expect(await uploadBuild(dist, target)).toBeUndefined();
		expect(await bucket.file(`${prefix}unbound.js`).text()).toBe('first build');
	});

	test('fails on a version an earlier upload left without its manifest', async () => {
		const partial = { ...target, version: crypto.randomUUID().replaceAll('-', '') };
		const key = `${versionPrefix(partial)}unbound.js`;

		await bucket.write(key, 'partial');

		try {
			const error = await uploadBuild(dist, partial).catch((cause: unknown) => cause);

			expect(error).toBeInstanceOf(IncompleteVersionError);
			expect(await bucket.file(key).text()).toBe('partial');
		} finally {
			await bucket.delete(key);
		}
	});
});

describe('parseUploadEnv', () => {
	test('requires a semver for stable and a commit SHA for beta', () => {
		const base = { ...process.env };

		expect(() =>
			parseUploadEnv({ ...base, UNBOUND_CHANNEL: 'stable', UNBOUND_VERSION: 'abc1234' }),
		).toThrow(/UNBOUND_VERSION/);
		expect(() =>
			parseUploadEnv({ ...base, UNBOUND_CHANNEL: 'beta', UNBOUND_VERSION: '1.2.3' }),
		).toThrow(/UNBOUND_VERSION/);
		expect(
			parseUploadEnv({ ...base, UNBOUND_CHANNEL: 'stable', UNBOUND_VERSION: '1.2.3' })
				.UNBOUND_VERSION,
		).toBe('1.2.3');
	});

	test('names a missing bucket credential', () => {
		const { S3_SECRET_ACCESS_KEY, ...missing } = process.env;

		expect(() =>
			parseUploadEnv({ ...missing, UNBOUND_CHANNEL: 'beta', UNBOUND_VERSION: 'abc1234' }),
		).toThrow(/S3_SECRET_ACCESS_KEY/);
	});
});
