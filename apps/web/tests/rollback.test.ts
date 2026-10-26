import type { UpdatesRequest } from '@unbound-app/contracts/updates';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { LATEST_VERSION, getAddonDetails, getCatalog, listAddons } from '~/lib/addons';
import { findUpdates, newestCompatibleVersions } from '~/lib/updates';
import type { ServeVersionResult } from '~/lib/rollback';
import { createSubmission } from '~/lib/submissions';
import { moderationEvent, user } from '~/db/schema';
import { getAdminAddon } from '~/lib/admin-addon';
import type { AppContext } from '~/lib/context';
import { reviewSubmission } from '~/lib/review';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';
import { serveVersion } from '~/lib/rollback';

import { createTestContext, linkGitHub, signInWithDiscord, snowflakeAt } from './helpers/context';
import { manifest, seedApprovedAddon, seedVersion } from './helpers/addons';
import { commitPlugin, serveGitHub } from './helpers/github';
import { explain, planNodes } from './helpers/database';
import { serveMemoryS3 } from './helpers/memory-s3';

const REPOSITORY = 'acme/addons';

const s3 = serveMemoryS3();
const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});
const base = await createTestContext({
	S3_ENDPOINT: s3.url.href,
	GITHUB_API_URL: github.url.href,
	SUBMISSION_RATE_LIMIT_MAX: '1000',
	ADDON_LIST_PAGE_SIZE: '100',
});
const ctx: AppContext = base.ctx;

afterAll(async () => {
	await Promise.all([s3.stop(true), github.stop()]);
	await base.close();
});

let users = 0;

async function signUp(role: Role = 'user') {
	users += 1;

	const { userId } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name: `Member ${users}`,
		email: `rollback-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	return { userId, caller: await currentCaller(userId) };
}

async function currentCaller(userId: string): Promise<Caller> {
	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	return { user: row, via: 'session' };
}

const owner = await signUp();
const admin = await signUp('admin');
const moderator = await signUp('moderator');

function release(id: string, version: string) {
	return manifest(id, version, { name: `Hello ${version}` });
}

async function seedReleases(id: string) {
	await seedApprovedAddon(ctx, owner.userId, release(id, '1.0.0'));
	await seedVersion(ctx, owner.userId, release(id, '1.1.0'));
	await seedVersion(ctx, owner.userId, release(id, '1.2.0'));
}

async function served(id: string) {
	const [catalog, listing, details, row] = await Promise.all([
		getCatalog(ctx),
		listAddons(ctx),
		getAddonDetails(ctx, id),
		ctx.db.query.addon.findFirst({ where: { id } }),
	]);

	return {
		catalog: catalog.addons.find((entry) => entry.id === id)?.latestVersion.version,
		listing: listing.addons.find((entry) => entry.id === id)?.latestVersion.version,
		details: details?.versions.map((version) => version.version),
		name: row?.name,
	};
}

async function offered(id: string, version: string, clientVersion: string = '9.0.0') {
	const { updates } = await findUpdates(ctx, { clientVersion, addons: [{ id, version }] });

	return updates.map((update) => [
		update.version,
		update.changelogs.map((entry) => entry.version),
	]);
}

function countEvents() {
	return ctx.db.$count(moderationEvent);
}

async function rejection(run: () => Promise<ServeVersionResult>): Promise<Error | undefined> {
	try {
		await run();
	} catch (error) {
		return error instanceof Error ? error : undefined;
	}
}

describe('serveVersion', () => {
	test('a rollback serves the target everywhere and records who, why and what changed', async () => {
		await seedReleases('rb.rollback');

		const before = await getCatalog(ctx);
		const result = await serveVersion(ctx, admin.caller, 'rb.rollback', {
			version: '1.0.0',
			reason: '1.2.0 crashes on launch',
		});

		expect(result).toMatchObject({
			served: '1.0.0',
			previous: '1.2.0',
			withdrawn: ['1.2.0', '1.1.0'],
			restored: [],
		});
		expect(await served('rb.rollback')).toEqual({
			catalog: '1.0.0',
			listing: '1.0.0',
			details: ['1.0.0'],
			name: 'Hello 1.0.0',
		});
		expect((await getCatalog(ctx)).revision).not.toBe(before.revision);

		const view = await getAdminAddon(ctx, admin.caller, 'rb.rollback');

		expect(view?.addon.latestVersion).toBe('1.0.0');
		expect(view?.events.items[0]).toMatchObject({
			id: result.eventId ?? -1,
			kind: 'addon.rollback',
			actor: { id: admin.userId },
			reason: '1.2.0 crashes on launch',
			data: { from: '1.2.0', to: '1.0.0', withdrawn: ['1.2.0', '1.1.0'], restored: [] },
		});
		expect(
			view?.versions.map((version) => [version.version, version.withdrawal?.eventId ?? null]),
		).toEqual([
			['1.2.0', result.eventId],
			['1.1.0', result.eventId],
			['1.0.0', null],
		]);
		expect(view?.versions[0]?.withdrawal?.by?.id).toBe(admin.userId);
	});

	test('offers clients on a withdrawn version the served one, and nothing to clients on it', async () => {
		await seedReleases('rb.downgrade');
		await serveVersion(ctx, admin.caller, 'rb.downgrade', {
			version: '1.0.0',
			reason: 'Broken',
		});

		expect(await offered('rb.downgrade', '1.2.0')).toEqual([['1.0.0', []]]);
		expect(await offered('rb.downgrade', '1.1.0')).toEqual([['1.0.0', []]]);
		expect(await offered('rb.downgrade', '1.0.0')).toEqual([]);
		expect(await offered('rb.downgrade', '0.9.0')).toEqual([['1.0.0', ['1.0.0']]]);
	});

	test('serving the pre-rollback version restores exactly what the rollback withdrew', async () => {
		await seedReleases('rb.undo');
		await serveVersion(ctx, admin.caller, 'rb.undo', { version: '1.0.0', reason: 'Broken' });

		const undo = await serveVersion(ctx, admin.caller, 'rb.undo', {
			version: '1.2.0',
			reason: 'False alarm',
		});

		expect(undo).toMatchObject({
			previous: '1.0.0',
			withdrawn: [],
			restored: ['1.2.0', '1.1.0'],
		});
		expect(await served('rb.undo')).toEqual({
			catalog: '1.2.0',
			listing: '1.2.0',
			details: ['1.2.0', '1.1.0', '1.0.0'],
			name: 'Hello 1.2.0',
		});
		expect(await offered('rb.undo', '1.0.0')).toEqual([['1.2.0', ['1.2.0', '1.1.0']]]);
	});

	test('serving a version between restores only it and leaves the newer ones withdrawn', async () => {
		await seedReleases('rb.between');
		await serveVersion(ctx, admin.caller, 'rb.between', { version: '1.0.0', reason: 'Broken' });

		const partial = await serveVersion(ctx, admin.caller, 'rb.between', {
			version: '1.1.0',
			reason: 'Only 1.2.0 is broken',
		});

		expect(partial).toMatchObject({ withdrawn: [], restored: ['1.1.0'] });
		expect((await served('rb.between')).details).toEqual(['1.1.0', '1.0.0']);
	});

	test('a new approval after a rollback is served while the withdrawn versions stay withdrawn', async () => {
		await seedReleases('rb.approval');
		await serveVersion(ctx, admin.caller, 'rb.approval', {
			version: '1.0.0',
			reason: 'Broken',
		});

		const developer = await currentCaller(owner.userId);
		const { request } = commitPlugin(
			github.repository(REPOSITORY),
			REPOSITORY,
			'rb.approval',
			'1.3.0',
			{
				'manifest.json': JSON.stringify({
					...manifest('rb.approval', '1.3.0', {
						name: 'Hello 1.3.0',
						unbound: { min: '5.0.0' },
					}),
					main: 'src/index.ts',
				}),
			},
		);

		await linkGitHub(ctx, owner.userId, 'owner');

		const { submission } = await createSubmission(ctx, developer, request);

		await reviewSubmission(ctx, admin.caller, submission.id, { decision: 'approved' });

		expect(await served('rb.approval')).toEqual({
			catalog: '1.3.0',
			listing: '1.3.0',
			details: ['1.3.0', '1.0.0'],
			name: 'Hello 1.3.0',
		});
		expect(await offered('rb.approval', '1.0.0')).toEqual([['1.3.0', ['1.3.0']]]);
		expect(await offered('rb.approval', '1.2.0', '4.0.0')).toEqual([['1.0.0', []]]);
		expect(await offered('rb.approval', '1.0.0', '4.0.0')).toEqual([]);
	});

	test('serving the served version writes nothing', async () => {
		await seedReleases('rb.noop');

		const events = await countEvents();
		const before = await getCatalog(ctx);
		const result = await serveVersion(ctx, admin.caller, 'rb.noop', {
			version: '1.2.0',
			reason: 'Again',
		});

		expect(result).toEqual({
			served: '1.2.0',
			previous: '1.2.0',
			withdrawn: [],
			restored: [],
			eventId: null,
		});
		expect(await countEvents()).toBe(events);
		expect((await getCatalog(ctx)).revision).toBe(before.revision);
	});

	test('refuses moderators, unknown versions and unknown addons', async () => {
		await seedReleases('rb.refused');

		const events = await countEvents();
		const request = { version: '1.0.0', reason: 'Broken' };

		expect(
			await rejection(() => serveVersion(ctx, moderator.caller, 'rb.refused', request)),
		).toMatchObject({ code: 'forbidden' });
		expect(
			await rejection(() =>
				serveVersion(ctx, admin.caller, 'rb.refused', { ...request, version: '3.0.0' }),
			),
		).toMatchObject({ code: 'not_found' });
		expect(
			await rejection(() => serveVersion(ctx, admin.caller, 'rb.unknown', request)),
		).toMatchObject({ code: 'not_found' });
		expect(await countEvents()).toBe(events);
		expect((await served('rb.refused')).catalog).toBe('1.2.0');
	});
});

describe('served-version reads', () => {
	test('the catalog reads the served version through the live index', async () => {
		const query = ctx.db.query.addon
			.findMany({ where: { delistedAt: { isNull: true } }, with: LATEST_VERSION })
			.toSQL();
		const nodes = planNodes(await explain(ctx.db, query));

		expect(nodes.map((node) => node['Index Name'])).toContain('addon_version_live_idx');
	});

	test('the update check reads live versions through the live index', async () => {
		const request: UpdatesRequest = {
			clientVersion: '2.0.0',
			addons: [{ id: 'rb.rollback', version: '1.0.0' }],
		};
		const query = newestCompatibleVersions(ctx, request).toSQL();
		const nodes = planNodes(await explain(ctx.db, query));

		expect(nodes.map((node) => node['Index Name'])).toContain('addon_version_live_idx');
		expect(nodes.map((node) => node['Node Type'])).not.toContain('Seq Scan');
	});
});
