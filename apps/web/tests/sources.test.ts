import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { catalogResponseSchema } from '@unbound-app/contracts/addons';
import type { Changelog } from '@unbound-app/contracts/changelog';
import { eq } from 'drizzle-orm';

import checkUpdatesEndpoint from '~/endpoints/check-updates';
import getCatalogEndpoint from '~/endpoints/get-catalog';
import { createApiClient } from '~/api/client';
import { getAddonDetails } from '~/lib/addons';
import { serveVersion } from '~/lib/rollback';
import { findUpdates } from '~/lib/updates';
import { user } from '~/db/schema';
import type { Api } from '~/api';

import {
	shippedCatalogResponseSchema,
	shippedUpdatesResponseSchema,
} from './helpers/shipped-contracts';
import { manifest, REPOSITORY_DETAILS, seedApprovedAddon, seedVersion } from './helpers/addons';
import { createTestContext, signInWithDiscord } from './helpers/context';
import { serveEndpoints } from './helpers/server';

const base = await createTestContext();
const ctx = base.ctx;
const server = serveEndpoints(ctx, {
	'GET /api/v1/catalog': getCatalogEndpoint,
	'POST /api/v1/updates': checkUpdatesEndpoint,
});
const client = createApiClient<Api>({ baseUrl: server.url.href });

const CHANGES: Changelog = {
	date: '2026-10-17',
	sections: [{ type: 'added', items: ['Changes in 1.1.0.'] }],
};

const SOURCED = { changelog: 'Added:\n- Changes in 1.1.0.', changes: CHANGES };
const LEGACY = { changelog: 'Changes in 1.0.0.', changes: null };

const PIN = {
	repository: 'acme/addons',
	repositoryId: 42,
	path: 'plugins/hello',
	ref: 'v1.1.0',
	commitSha: 'c'.repeat(40),
	bundlePath: 'plugins/hello/dist/index.js',
	bundleBlobSha: 'b'.repeat(40),
};

const WITHDRAWN: Changelog = {
	date: '2026-10-18',
	sections: [{ type: 'fixed', items: ['Withdrawn change.'] }],
};

const UPDATES_REQUEST = {
	clientVersion: '1.0.0',
	addons: [
		{ id: 'src.mixed', version: '0.9.0' },
		{ id: 'src.legacy', version: '0.9.0' },
	],
};

afterAll(async () => {
	await server.stop(true);
	await base.close();
});

beforeAll(async () => {
	const { userId } = await signInWithDiscord(ctx, {
		id: '80351110224679101',
		name: 'Sourcer',
		email: 'sourcer@example.com',
	});

	await seedApprovedAddon(ctx, userId, manifest('src.legacy', '1.0.0'));
	await seedApprovedAddon(ctx, userId, manifest('src.mixed', '1.0.0'));
	await seedVersion(ctx, userId, manifest('src.mixed', '1.1.0'), undefined, {
		repositoryId: 42,
		ref: 'v1.1.0',
		commitSha: 'c'.repeat(40),
		bundleBlobSha: 'b'.repeat(40),
		addonMd: '# Mixed',
	});
	await seedApprovedAddon(ctx, userId, manifest('src.bare', '1.0.0'), {
		changelog: null,
		addonMd: null,
	});

	await seedApprovedAddon(ctx, userId, manifest('src.withdrawn', '1.0.0'), {});
	await seedVersion(ctx, userId, manifest('src.withdrawn', '1.1.0'), undefined, {
		changelog: WITHDRAWN,
		addonMd: '# Withdrawn',
	});

	const { userId: adminId } = await signInWithDiscord(ctx, {
		id: '80351110224679102',
		name: 'Admin',
		email: 'source-admin@example.com',
	});

	await ctx.db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));

	const admin = await ctx.db.query.user.findFirst({ where: { id: adminId } });

	if (!admin) {
		throw new Error(`User ${adminId} was not stored.`);
	}

	await serveVersion(ctx, { user: admin, via: 'session' }, 'src.withdrawn', {
		version: '1.0.0',
		reason: '1.1.0 crashes',
	});
});

describe('versions read from GitHub', () => {
	test('the catalog carries text and sections for a sourced version, text alone for a legacy one', async () => {
		const { addons } = await client('GET /api/v1/catalog', { response: catalogResponseSchema });
		const latest = new Map(addons.map((entry) => [entry.id, entry.latestVersion]));

		expect(latest.get('src.mixed')).toMatchObject({ ...SOURCED, source: PIN });
		expect(latest.get('src.legacy')).toMatchObject({ ...LEGACY, source: null });
		expect(latest.get('src.bare')).toMatchObject({ changelog: null, changes: null });
		expect(latest.get('src.bare')?.source?.repository).toBe('acme/addons');
	});

	test('details render each version in its own format, with the newest ADDON.md and details', async () => {
		const details = await getAddonDetails(ctx, 'src.mixed');

		expect(details?.versions.map(({ changelog, changes }) => ({ changelog, changes }))).toEqual(
			[SOURCED, LEGACY],
		);
		expect(details?.addonMd).toBe('# Mixed');
		expect(details?.details).toEqual(REPOSITORY_DETAILS);

		const legacy = await getAddonDetails(ctx, 'src.legacy');

		expect(legacy?.addonMd).toBeNull();
		expect(legacy?.details).toBeNull();
	});

	test('the update check returns text and sections for the offered and skipped versions', async () => {
		const { updates } = await findUpdates(ctx, UPDATES_REQUEST);
		const byId = new Map(updates.map((update) => [update.id, update]));

		expect(byId.get('src.mixed')).toMatchObject(SOURCED);
		expect(
			byId.get('src.mixed')?.changelogs.map(({ version, changelog, changes }) => ({
				version,
				changelog,
				changes,
			})),
		).toEqual([
			{ version: '1.1.0', ...SOURCED },
			{ version: '1.0.0', ...LEGACY },
		]);
		expect(byId.get('src.legacy')).toMatchObject(LEGACY);
	});
});

describe('withdrawn versions', () => {
	test('stay out of details, the catalog and the update check, changes included', async () => {
		const details = await getAddonDetails(ctx, 'src.withdrawn');
		const { addons } = await client('GET /api/v1/catalog', { response: catalogResponseSchema });
		const listed = addons.find((entry) => entry.id === 'src.withdrawn');
		const { updates } = await findUpdates(ctx, {
			clientVersion: '1.0.0',
			addons: [{ id: 'src.withdrawn', version: '0.9.0' }],
		});
		const rolledBack = await findUpdates(ctx, {
			clientVersion: '1.0.0',
			addons: [{ id: 'src.withdrawn', version: '1.1.0' }],
		});

		expect(details?.versions.map((version) => version.version)).toEqual(['1.0.0']);
		expect(details?.addonMd).not.toBe('# Withdrawn');
		expect(listed?.latestVersion.version).toBe('1.0.0');
		expect(
			updates.map((update) => [
				update.version,
				update.changelogs.map((entry) => entry.version),
			]),
		).toEqual([['1.0.0', ['1.0.0']]]);
		expect(rolledBack.updates.map((update) => [update.version, update.changelogs])).toEqual([
			['1.0.0', []],
		]);

		for (const read of [details, listed, updates, rolledBack]) {
			expect(JSON.stringify(read)).not.toContain('Withdrawn change.');
		}
	});

	test('load their withdrawal and source through one relational query', async () => {
		const version = await ctx.db.query.addonVersion.findFirst({
			where: { addonId: 'src.withdrawn', version: '1.1.0' },
			with: { withdrawal: true, source: true, submission: true },
		});

		expect(version?.withdrawal).toMatchObject({
			kind: 'addon.rollback',
			reason: '1.1.0 crashes',
		});
		expect(version?.source).toMatchObject({ changelog: WITHDRAWN, addonMd: '# Withdrawn' });
		expect(version?.submission?.id).toBe(version?.submissionId);
	});
});

describe('shipped clients', () => {
	test('still parse the catalog, reading the changelog as text and dropping the new fields', async () => {
		const response = await fetch(new URL('/api/v1/catalog', server.url));
		const parsed = shippedCatalogResponseSchema.safeParse(await response.json());

		expect(parsed.error).toBeUndefined();

		const mixed = parsed.data?.addons.find((entry) => entry.id === 'src.mixed');

		expect(mixed?.latestVersion.changelog).toBe(SOURCED.changelog);
		expect(Object.keys(mixed?.latestVersion ?? {})).not.toContain('changes');
		expect(Object.keys(mixed?.latestVersion ?? {})).not.toContain('source');
	});

	test('still parse the update check', async () => {
		const response = await fetch(new URL('/api/v1/updates', server.url), {
			method: 'POST',
			headers: { [ctx.env.IP_ADDRESS_HEADER]: '203.0.113.7' },
			body: JSON.stringify(UPDATES_REQUEST),
		});
		const parsed = shippedUpdatesResponseSchema.safeParse(await response.json());

		expect(parsed.error).toBeUndefined();

		const mixed = parsed.data?.updates.find((update) => update.id === 'src.mixed');

		expect(mixed?.changelog).toBe(SOURCED.changelog);
		expect(mixed?.changelogs.map((entry) => entry.changelog)).toEqual([
			SOURCED.changelog,
			LEGACY.changelog,
		]);
	});
});
