import { afterAll, describe, expect, test } from 'bun:test';

import { S3_TEST_ENV, createTestContext } from './helpers/context';

const { ctx, close } = await createTestContext(S3_TEST_ENV);

const key = `tests/${crypto.randomUUID()}/index.js`;

afterAll(async () => {
	await Promise.all([ctx.storage.staging.delete(key), ctx.storage.public.delete(key)]);
	await close();
});

describe('createStorage', () => {
	test('staging and public are separate buckets', async () => {
		await ctx.storage.staging.write(key, 'staged');

		expect(await ctx.storage.staging.file(key).text()).toBe('staged');
		expect(await ctx.storage.public.exists(key)).toBe(false);

		await ctx.storage.public.write(key, 'published');

		expect(await ctx.storage.public.file(key).text()).toBe('published');
		expect(await ctx.storage.staging.file(key).text()).toBe('staged');
	});

	test('presigns a staging download for reviewers', async () => {
		const url = ctx.storage.staging.presign(key, { method: 'GET', expiresIn: 60 });
		const response = await fetch(url);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('staged');
	});
});
