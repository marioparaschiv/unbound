import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { catalogResponseSchema } from '@unbound-app/contracts/addons';
import { eq } from 'drizzle-orm';

import { createApiClient, NotModifiedError } from '~/api/client';
import getCatalogEndpoint from '~/endpoints/get-catalog';
import { addon } from '~/db/schema';
import type { Api } from '~/api';

import { manifest, seedApprovedAddon, seedSubmission, seedVersion } from './helpers/addons';
import { createTestContext, signInWithDiscord } from './helpers/context';
import { serveEndpoints } from './helpers/server';

const base = createTestContext({ ADDON_LIST_PAGE_SIZE: '1' });
const ctx = base.ctx;
const server = serveEndpoints(ctx, { 'GET /api/v1/catalog': getCatalogEndpoint });
const client = createApiClient<Api>({ baseUrl: server.url.href });
const url = new URL('/api/v1/catalog', server.url);

let ownerId = '';

afterAll(async () => {
	await server.stop(true);
	base.close();
});

beforeAll(async () => {
	({ userId: ownerId } = await signInWithDiscord(ctx, {
		id: '80351110224679002',
		name: 'Cataloguer',
		email: 'cataloguer@example.com',
	}));

	await seedApprovedAddon(ctx, ownerId, manifest('cat.plugin', '1.0.0', { name: 'Plugin' }));
	await seedApprovedAddon(
		ctx,
		ownerId,
		manifest('cat.theme', '1.0.0', { name: 'Theme', type: 'theme', main: 'theme.json' }),
	);
	await seedApprovedAddon(ctx, ownerId, manifest('cat.hidden', '1.0.0'));
	await ctx.db.update(addon).set({ delistedAt: ctx.now() }).where(eq(addon.id, 'cat.hidden'));
	await seedSubmission(ctx, ownerId, manifest('cat.pending', '1.0.0'));
});

function setDelisted(id: string, delisted: boolean) {
	return ctx.db
		.update(addon)
		.set({ delistedAt: delisted ? ctx.now() : null })
		.where(eq(addon.id, id));
}

function get(ifNoneMatch?: string) {
	return fetch(url, { headers: ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {} });
}

describe('GET /api/v1/catalog', () => {
	test('returns every listed addon in one snapshot, ignoring the page size', async () => {
		const catalog = await client('GET /api/v1/catalog', { response: catalogResponseSchema });

		expect(catalog.addons.map((entry) => [entry.id, entry.type])).toEqual([
			['cat.plugin', 'plugin'],
			['cat.theme', 'theme'],
		]);
		expect(catalog.addons[0]?.latestVersion.version).toBe('1.0.0');
	});

	test('serves the revision as a strong ETag', async () => {
		const response = await get();
		const catalog = catalogResponseSchema.parse(await response.json());

		expect(response.headers.get('etag')).toBe(`"${catalog.revision}"`);
		expect(response.headers.get('cache-control')).toBe('no-cache');
	});

	test('answers a matching If-None-Match with an empty 304', async () => {
		const etag = (await get()).headers.get('etag') ?? '';

		for (const header of [etag, `W/${etag}`, `"stale", ${etag}`, '*']) {
			const response = await get(header);

			expect(response.status).toBe(304);
			expect(response.headers.get('etag')).toBe(etag);
			expect(await response.text()).toBe('');
		}

		const request = client('GET /api/v1/catalog', {
			response: catalogResponseSchema,
			headers: { 'If-None-Match': etag },
		});

		expect(await request.catch((cause: unknown) => cause)).toBeInstanceOf(NotModifiedError);
	});

	test('changes the revision when an approval or a delist changes the set', async () => {
		const first = (await get()).headers.get('etag') ?? '';

		await seedVersion(ctx, ownerId, manifest('cat.plugin', '1.1.0', { name: 'Plugin' }));

		const approved = await get(first);
		const catalog = catalogResponseSchema.parse(await approved.json());

		expect(approved.status).toBe(200);
		expect(catalog.addons[0]?.latestVersion.version).toBe('1.1.0');

		const second = approved.headers.get('etag') ?? '';

		await setDelisted('cat.theme', true);

		const delisted = await get(second);

		expect(delisted.status).toBe(200);
		expect(catalogResponseSchema.parse(await delisted.json()).addons).toHaveLength(1);

		await setDelisted('cat.theme', false);

		// The revision is derived from the listed set, so relisting restores the earlier one.
		expect((await get(second)).status).toBe(304);
	});
});
