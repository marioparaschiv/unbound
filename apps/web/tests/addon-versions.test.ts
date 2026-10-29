import { addonVersionsResponseSchema } from '@unbound-app/contracts/addons';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import listAddonVersionsEndpoint from '~/endpoints/list-addon-versions';
import { createApiClient } from '~/api/client';
import { serveVersion } from '~/lib/rollback';
import { addon, user } from '~/db/schema';
import type { Api } from '~/api';

import { manifest, seedApprovedAddon, seedSubmission, seedVersion } from './helpers/addons';
import { createTestContext, signInWithDiscord } from './helpers/context';
import { failure, serveEndpoints } from './helpers/server';

const base = await createTestContext();
const ctx = base.ctx;
const server = serveEndpoints(ctx, {
	'GET /api/v1/addons/$id/versions': listAddonVersionsEndpoint,
});
const client = createApiClient<Api>({ baseUrl: server.url.href });

afterAll(async () => {
	await server.stop(true);
	await base.close();
});

beforeAll(async () => {
	const { userId: ownerId } = await signInWithDiscord(ctx, {
		id: '80351110224679101',
		name: 'Versioner',
		email: 'versioner@example.com',
	});
	const { userId: adminId } = await signInWithDiscord(ctx, {
		id: '80351110224679102',
		name: 'Admin',
		email: 'versions-admin@example.com',
	});

	await ctx.db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));

	const admin = await ctx.db.query.user.findFirst({ where: { id: adminId } });

	if (!admin) {
		throw new Error(`User ${adminId} was not stored.`);
	}

	await seedApprovedAddon(ctx, ownerId, manifest('ver.plugin', '1.0.0'));
	await seedVersion(ctx, ownerId, manifest('ver.plugin', '1.10.0'));
	await seedVersion(ctx, ownerId, manifest('ver.plugin', '1.2.0'));
	await seedSubmission(ctx, ownerId, manifest('ver.plugin', '2.0.0'), { kind: 'update' });

	await seedApprovedAddon(ctx, ownerId, manifest('ver.rolledback', '1.0.0'));
	await seedVersion(ctx, ownerId, manifest('ver.rolledback', '1.1.0'));
	await serveVersion(ctx, { user: admin, via: 'session' }, 'ver.rolledback', {
		version: '1.0.0',
		reason: '1.1.0 crashes',
	});

	await seedApprovedAddon(ctx, ownerId, manifest('ver.hidden', '1.0.0'));
	await ctx.db.update(addon).set({ delistedAt: ctx.now() }).where(eq(addon.id, 'ver.hidden'));
});

function versionsOf(id: string) {
	return client('GET /api/v1/addons/$id/versions', {
		params: { id },
		response: addonVersionsResponseSchema,
	});
}

describe('GET /api/v1/addons/$id/versions', () => {
	test('lists every approved version newest first by semver, with CDN URLs', async () => {
		const { versions } = await versionsOf('ver.plugin');

		expect(versions.map((version) => version.version)).toEqual(['1.10.0', '1.2.0', '1.0.0']);
		expect(versions[0]?.manifestUrl).toBe(
			`${ctx.env.CDN_URL}/addons/ver.plugin/1.10.0/manifest.json`,
		);
	});

	test('leaves out versions a rollback withdrew', async () => {
		const { versions } = await versionsOf('ver.rolledback');

		expect(versions.map((version) => version.version)).toEqual(['1.0.0']);
	});

	test('answers not_found for an unknown or delisted addon', async () => {
		for (const id of ['ver.unknown', 'ver.hidden']) {
			expect(await failure(versionsOf(id))).toEqual({ status: 404, code: 'not_found' });
		}
	});
});
