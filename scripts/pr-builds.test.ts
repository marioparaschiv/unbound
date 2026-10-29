import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { PublicBucket } from '../packages/client/scripts/build/upload';

import {
	clientPrefix,
	deletePullRequestBuilds,
	loaderPrefix,
	parsePullRequest,
	uploadLoaderBuilds,
} from './pr-builds';
import { listKeys, uploadBuild } from '../packages/client/scripts/build/upload';

function createMemoryBucket(initial: Record<string, string> = {}, pageSize = 2) {
	const objects = new Map(Object.entries(initial));

	const bucket: PublicBucket = {
		async write(key, data) {
			objects.set(key, await new Response(data as BodyInit).text());

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
			const start = Number(input?.continuationToken ?? 0);
			const limit = input?.maxKeys ?? pageSize;
			const page = keys.slice(start, start + limit);
			const next = start + page.length;

			return {
				keyCount: page.length,
				contents: page.map((key) => ({ key })),
				isTruncated: next < keys.length,
				nextContinuationToken: next < keys.length ? String(next) : void 0,
			};
		},
	};

	return { bucket, objects };
}

const dist = mkdtempSync(join(tmpdir(), 'unbound-pr-build-'));

afterAll(() => rmSync(dist, { recursive: true, force: true }));

describe('parsePullRequest', () => {
	test('accepts only positive pull request numbers', () => {
		expect(parsePullRequest('42')).toBe('42');

		for (const value of [undefined, '', '0', '-1', '4a', '../42']) {
			expect(() => parsePullRequest(value)).toThrow(/not a pull request number/);
		}
	});

	test('keys both builds by the pull request', () => {
		expect(clientPrefix('42')).toBe('unbound/pr/42/');
		expect(loaderPrefix('42')).toBe('loader/pr/42/');
	});
});

describe('listKeys', () => {
	test('follows continuation tokens', async () => {
		const { bucket } = createMemoryBucket({ 'a/1': '', 'a/2': '', 'a/3': '', 'b/1': '' });

		expect(await listKeys(bucket, 'a/')).toEqual(['a/1', 'a/2', 'a/3']);
	});
});

describe('uploadBuild for pull requests', () => {
	test('overwrites the latest build and removes files it no longer has', async () => {
		const { bucket, objects } = createMemoryBucket({
			'unbound/pr/42/manifest.json': 'old',
			'unbound/pr/42/unbound.94.bundle': 'old',
			'unbound/pr/7/manifest.json': 'other',
		});

		await Bun.write(join(dist, 'manifest.json'), '{"bytecodeVersions":[96]}');
		await Bun.write(join(dist, 'unbound.96.bundle'), 'new');
		await Bun.write(join(dist, 'unbound.96.bundle.map'), '{}');

		const keys = await uploadBuild(dist, { bucket, channel: 'pr', version: '42' });

		expect(keys?.at(-1)).toBe('unbound/pr/42/manifest.json');
		expect([...objects.keys()].toSorted()).toEqual([
			'unbound/pr/42/manifest.json',
			'unbound/pr/42/unbound.96.bundle',
			'unbound/pr/7/manifest.json',
		]);
		expect(objects.get('unbound/pr/42/manifest.json')).toBe('{"bytecodeVersions":[96]}');
	});

	test('still never overwrites a release version', async () => {
		const { bucket, objects } = createMemoryBucket({
			'unbound/beta/abc1234/manifest.json': 'kept',
		});

		expect(
			await uploadBuild(dist, { bucket, channel: 'beta', version: 'abc1234' }),
		).toBeUndefined();
		expect(objects.get('unbound/beta/abc1234/manifest.json')).toBe('kept');
	});
});

describe('uploadLoaderBuilds', () => {
	test('replaces the pull request loader builds under stable names', async () => {
		const { bucket, objects } = createMemoryBucket({ 'loader/pr/42/Old.ipa': 'stale' });
		const ipa = join(dist, 'Unbound.ipa');
		const apk = join(dist, 'app.unbound.android.xposed.apk');

		await Bun.write(ipa, 'ipa');
		await Bun.write(apk, 'apk');

		expect(await uploadLoaderBuilds(bucket, '42', [ipa, apk])).toEqual([
			'loader/pr/42/Unbound.ipa',
			'loader/pr/42/app.unbound.android.xposed.apk',
		]);
		expect([...objects.keys()].toSorted()).toEqual([
			'loader/pr/42/Unbound.ipa',
			'loader/pr/42/app.unbound.android.xposed.apk',
		]);
	});

	test('refuses an empty or ambiguous upload', async () => {
		const { bucket } = createMemoryBucket();

		const empty = await uploadLoaderBuilds(bucket, '42', []).catch((cause: unknown) => cause);
		const ambiguous = await uploadLoaderBuilds(bucket, '42', [
			join(dist, 'a', 'Unbound.ipa'),
			join(dist, 'b', 'Unbound.ipa'),
		]).catch((cause: unknown) => cause);

		expect(String(empty)).toMatch(/No loader builds/);
		expect(String(ambiguous)).toMatch(/share a file name/);
	});
});

describe('deletePullRequestBuilds', () => {
	test('removes only the client and loader builds of that pull request', async () => {
		const { bucket, objects } = createMemoryBucket({
			'unbound/pr/42/manifest.json': '',
			'unbound/pr/42/unbound.96.bundle': '',
			'unbound/pr/420/manifest.json': '',
			'loader/pr/42/Unbound.ipa': '',
			'unbound/stable/1.0.0/manifest.json': '',
		});

		expect((await deletePullRequestBuilds(bucket, '42')).toSorted()).toEqual([
			'loader/pr/42/Unbound.ipa',
			'unbound/pr/42/manifest.json',
			'unbound/pr/42/unbound.96.bundle',
		]);
		expect([...objects.keys()].toSorted()).toEqual([
			'unbound/pr/420/manifest.json',
			'unbound/stable/1.0.0/manifest.json',
		]);
	});
});
