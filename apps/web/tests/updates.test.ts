import { MAX_UPDATE_CHANGELOGS, updatesResponseSchema } from '@unbound-app/contracts/updates';
import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';
import type { UpdatesRequest } from '@unbound-app/contracts/updates';
import { eq } from 'drizzle-orm';

import { findUpdates, newestCompatibleVersions } from '~/lib/updates';
import checkUpdatesEndpoint from '~/endpoints/check-updates';
import type { AppContext } from '~/lib/context';
import { serveVersion } from '~/lib/rollback';
import { addon, user } from '~/db/schema';

import { manifest, seedApprovedAddon, seedSubmission, seedVersion } from './helpers/addons';
import { createTestContext, signInWithDiscord } from './helpers/context';
import { explain, indexCond, planNodes } from './helpers/database';

const NOW = new Date('2026-10-17T12:00:00.000Z');

const base = await createTestContext();
const ctx: AppContext = { ...base.ctx, now: () => NOW };

afterAll(base.close);

let ownerId = '';

beforeAll(async () => {
	({ userId: ownerId } = await signInWithDiscord(ctx, {
		id: '80351110224678920',
		name: 'Owner',
		email: 'owner@example.com',
	}));

	await seedApprovedAddon(ctx, ownerId, manifest('up.newer', '1.0.0'));
	await seedVersion(ctx, ownerId, manifest('up.newer', '1.1.0'));
	await seedVersion(ctx, ownerId, manifest('up.newer', '1.10.0'));
	await seedVersion(ctx, ownerId, manifest('up.newer', '1.2.0'));

	await seedApprovedAddon(ctx, ownerId, manifest('up.compat', '1.0.0'));
	await seedVersion(ctx, ownerId, manifest('up.compat', '1.1.0', { unbound: { min: '2.0.0' } }));
	await seedVersion(ctx, ownerId, manifest('up.compat', '2.0.0', { unbound: { min: '3.0.0' } }));

	await seedApprovedAddon(ctx, ownerId, manifest('up.current', '1.0.0'));

	await seedApprovedAddon(ctx, ownerId, manifest('up.many', '1.0.0'));

	for (let minor = 1; minor <= MAX_UPDATE_CHANGELOGS + 5; minor++) {
		await seedVersion(ctx, ownerId, manifest('up.many', `1.${minor}.0`));
	}

	await seedApprovedAddon(ctx, ownerId, manifest('up.delisted', '1.0.0'));
	await seedVersion(ctx, ownerId, manifest('up.delisted', '1.1.0'));
	await ctx.db.update(addon).set({ delistedAt: NOW }).where(eq(addon.id, 'up.delisted'));

	await seedApprovedAddon(ctx, ownerId, manifest('up.unapproved', '1.0.0'));
	await seedSubmission(ctx, ownerId, manifest('up.unapproved', '1.1.0'), { kind: 'update' });

	await seedApprovedAddon(ctx, ownerId, manifest('up.rolledback', '1.0.0'));
	await seedVersion(ctx, ownerId, manifest('up.rolledback', '1.1.0'));
	await seedVersion(ctx, ownerId, manifest('up.rolledback', '1.2.0'));

	const { userId: adminId } = await signInWithDiscord(ctx, {
		id: '80351110224678921',
		name: 'Admin',
		email: 'admin@example.com',
	});

	await ctx.db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));

	const admin = await ctx.db.query.user.findFirst({ where: { id: adminId } });

	if (!admin) {
		throw new Error(`User ${adminId} was not stored.`);
	}

	await serveVersion(ctx, { user: admin, via: 'session' }, 'up.rolledback', {
		version: '1.0.0',
		reason: '1.1.0 and 1.2.0 crash',
	});
});

// Malformed bodies still fit the type: the schema refuses their values, not their shape.
function check(body: UpdatesRequest, target: AppContext = ctx, ip: string = '203.0.113.1') {
	return checkUpdatesEndpoint.handle(
		target,
		new Request(new URL('/api/v1/updates', target.env.PUBLIC_URL), {
			method: 'POST',
			headers: { [target.env.IP_ADDRESS_HEADER]: ip },
			body: JSON.stringify(body),
		}),
	);
}

async function updatesFor(request: UpdatesRequest) {
	const response = await check(request);

	expect(response.status).toBe(200);

	return updatesResponseSchema.parse(await response.json()).updates;
}

async function refused(response: Response) {
	const { error } = apiErrorResponseSchema.parse(await response.json());

	return { status: response.status, code: error.code };
}

describe('POST /api/v1/updates', () => {
	test('returns the newest newer version by semver, with CDN URLs', async () => {
		const updates = await updatesFor({
			clientVersion: '1.0.0',
			addons: [{ id: 'up.newer', version: '1.0.0' }],
		});

		const row = await ctx.db.query.addonVersion.findFirst({
			where: { addonId: 'up.newer', version: '1.10.0' },
		});

		expect(updates).toEqual([
			{
				id: 'up.newer',
				version: '1.10.0',
				manifestUrl: `${ctx.env.CDN_URL}/addons/up.newer/1.10.0/manifest.json`,
				bundleUrl: `${ctx.env.CDN_URL}/addons/up.newer/1.10.0/index.js`,
				sha256: row?.sha256 ?? '',
				changelog: 'Changes in 1.10.0.',
				changes: null,
				changelogs: ['1.10.0', '1.2.0', '1.1.0'].map((version) => ({
					version,
					changelog: `Changes in ${version}.`,
					changes: null,
					publishedAt: NOW.toISOString(),
				})),
			},
		]);
	});

	test('lists the changelogs of only the versions an update skips over, newest first', async () => {
		async function versions(id: string, version: string, clientVersion: string = '9.0.0') {
			const [update] = await updatesFor({ clientVersion, addons: [{ id, version }] });

			return update?.changelogs.map((entry) => entry.version);
		}

		expect(await versions('up.newer', '1.1.0')).toEqual(['1.10.0', '1.2.0']);
		expect(await versions('up.compat', '1.0.0', '2.5.0')).toEqual(['1.1.0']);
		expect(await versions('up.many', '1.0.0')).toEqual(
			Array.from(
				{ length: MAX_UPDATE_CHANGELOGS },
				(_, index) => `1.${MAX_UPDATE_CHANGELOGS + 5 - index}.0`,
			),
		);
	});

	test('skips versions that need a newer client for an older compatible one', async () => {
		const request = (clientVersion: string) =>
			updatesFor({ clientVersion, addons: [{ id: 'up.compat', version: '1.0.0' }] });

		expect((await request('1.9.0')).map((update) => update.version)).toEqual([]);
		expect((await request('2.5.0')).map((update) => update.version)).toEqual(['1.1.0']);
		expect((await request('3.0.0')).map((update) => update.version)).toEqual(['2.0.0']);
	});

	test('omits up-to-date, ahead, unknown, delisted and unapproved addons', async () => {
		const updates = await updatesFor({
			clientVersion: '9.0.0',
			addons: [
				{ id: 'up.current', version: '1.0.0' },
				{ id: 'up.newer', version: '2.0.0' },
				{ id: 'up.unknown', version: '1.0.0' },
				{ id: 'up.delisted', version: '1.0.0' },
				{ id: 'up.unapproved', version: '1.0.0' },
			],
		});

		expect(updates).toEqual([]);
	});

	test('rejects a malformed body and an oversize batch with invalid_request', async () => {
		const oversize = Array.from({ length: 501 }, (_, index) => ({
			id: `addon-${index}`,
			version: '1.0.0',
		}));

		expect(await refused(await check({ clientVersion: 'latest', addons: [] }))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
		expect(await refused(await check({ clientVersion: '1.0.0', addons: oversize }))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
	});

	test('rate limits each client IP within UPDATES_RATE_LIMIT_WINDOW_SECONDS', async () => {
		const limited = await createTestContext({ UPDATES_RATE_LIMIT_MAX: '2' });
		let clock = NOW;
		const target: AppContext = { ...limited.ctx, now: () => clock };
		const body = { clientVersion: '1.0.0', addons: [] };

		try {
			expect((await check(body, target)).status).toBe(200);
			expect((await check(body, target)).status).toBe(200);
			expect(await refused(await check(body, target))).toEqual({
				status: 429,
				code: 'rate_limited',
			});
			expect((await check(body, target, '203.0.113.2')).status).toBe(200);

			clock = new Date(NOW.getTime() + target.env.UPDATES_RATE_LIMIT_WINDOW_SECONDS * 1000);

			expect((await check(body, target)).status).toBe(200);
		} finally {
			await limited.close();
		}
	});
});

describe('findUpdates', () => {
	const request: UpdatesRequest = {
		clientVersion: '2.0.0',
		addons: [
			{ id: 'up.newer', version: '1.0.0' },
			{ id: 'up.compat', version: '1.0.0' },
			{ id: 'up.current', version: '1.0.0' },
		],
	};

	test('resolves the whole batch in three statements, one when nothing is newer', async () => {
		// Drizzle's postgres.js session runs every statement through `unsafe`.
		const statements = spyOn(ctx.db.$client, 'unsafe');

		try {
			const { updates } = await findUpdates(ctx, request);

			expect(updates.map((update) => update.id)).toEqual(['up.compat', 'up.newer']);
			expect(statements).toHaveBeenCalledTimes(3);

			statements.mockClear();

			expect(
				await findUpdates(ctx, {
					...request,
					addons: [{ id: 'up.current', version: '1.0.0' }],
				}),
			).toEqual({ updates: [] });
			expect(statements).toHaveBeenCalledTimes(1);
		} finally {
			statements.mockRestore();
		}
	});

	test('offers the served version to a client on a withdrawn one, in three statements', async () => {
		const statements = spyOn(ctx.db.$client, 'unsafe');

		try {
			const { updates } = await findUpdates(ctx, {
				clientVersion: '2.0.0',
				addons: [
					{ id: 'up.rolledback', version: '1.2.0' },
					{ id: 'up.current', version: '1.0.0' },
				],
			});

			expect(updates).toMatchObject([
				{
					id: 'up.rolledback',
					version: '1.0.0',
					bundleUrl: `${ctx.env.CDN_URL}/addons/up.rolledback/1.0.0/index.js`,
					changelogs: [],
				},
			]);
			expect(statements).toHaveBeenCalledTimes(3);
		} finally {
			statements.mockRestore();
		}
	});

	test('skips withdrawn versions in updates and their changelogs', async () => {
		const request = (version: string) =>
			findUpdates(ctx, {
				clientVersion: '2.0.0',
				addons: [{ id: 'up.rolledback', version }],
			});

		expect(await request('1.0.0')).toEqual({ updates: [] });
		expect(
			(await request('0.9.0')).updates.map((update) => [
				update.version,
				update.changelogs.map((entry) => entry.version),
			]),
		).toEqual([['1.0.0', ['1.0.0']]]);
	});

	test('reads only the listed addons through an index, never a table scan', async () => {
		const root = await explain(ctx.db, newestCompatibleVersions(ctx, request).toSQL());

		expect(indexCond(root, 'addon_version_live_idx')).toMatch(/^\(addon_id = /);
		expect(planNodes(root).map((node) => node['Node Type'])).not.toContain('Seq Scan');
	});
});
