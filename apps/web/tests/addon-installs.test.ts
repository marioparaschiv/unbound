import { addonInstallResponseSchema } from '@unbound-app/contracts/addons';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { parse } from '@unbound-app/contracts/schema';
import { eq, like } from 'drizzle-orm';

import countAddonInstallEndpoint from '~/endpoints/count-addon-install';
import { addon, rateLimit } from '~/db/schema';
import { getCatalog } from '~/lib/addons';

import { createTestContext, signInWithDiscord } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';

const base = await createTestContext({ ADDON_INSTALLS_RATE_LIMIT_MAX: '2' });
const ctx = base.ctx;

afterAll(base.close);

beforeAll(async () => {
	const { userId } = await signInWithDiscord(ctx, {
		id: '80351110224679010',
		name: 'Counter',
		email: 'counter@example.com',
	});

	await seedApprovedAddon(ctx, userId, manifest('count.plugin', '1.0.0'));
	await seedApprovedAddon(ctx, userId, manifest('count.gone', '1.0.0'));
	await ctx.db.update(addon).set({ delistedAt: ctx.now() }).where(eq(addon.id, 'count.gone'));
});

function send(id: string, ip: string) {
	return countAddonInstallEndpoint.handle(
		ctx,
		new Request(new URL(`/api/v1/addons/${id}/installs`, ctx.env.PUBLIC_URL), {
			method: 'POST',
			headers: { [ctx.env.IP_ADDRESS_HEADER]: ip },
		}),
		{ id },
	);
}

describe('addon installs', () => {
	test('counts an install and lists the count in the catalog', async () => {
		const response = await send('count.plugin', '203.0.113.20');

		expect(response.status).toBe(200);
		expect(parse(addonInstallResponseSchema, await response.json()).installs).toBe(1);

		const before = await getCatalog(ctx);

		await send('count.plugin', '203.0.113.21');

		const after = await getCatalog(ctx);

		expect(after.addons.find((entry) => entry.id === 'count.plugin')?.installs).toBe(2);
		expect(after.revision).not.toBe(before.revision);
	});

	test('refuses unknown and delisted addons', async () => {
		expect((await send('count.missing', '203.0.113.22')).status).toBe(404);
		expect((await send('count.gone', '203.0.113.22')).status).toBe(404);

		const [gone] = await ctx.db.select().from(addon).where(eq(addon.id, 'count.gone'));

		expect(gone?.installs).toBe(0);
	});

	test('limits how often one address counts an addon, without storing the address', async () => {
		const statuses: number[] = [];

		for (let index = 0; index < 3; index++) {
			statuses.push((await send('count.plugin', '203.0.113.23')).status);
		}

		expect(statuses).toEqual([200, 200, 429]);

		const keys = await ctx.db
			.select({ key: rateLimit.key })
			.from(rateLimit)
			.where(like(rateLimit.key, 'api:addon-installs:%'));

		expect(keys.length).toBeGreaterThan(0);
		expect(keys.some(({ key }) => key.includes('203.0.113'))).toBe(false);
	});
});
