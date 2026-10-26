import type { AddonSort, ListAddonsQuery, SortOrder } from '@unbound-app/contracts/addons';
import { listAddonsResponseSchema } from '@unbound-app/contracts/addons';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { getAddonDetails, queryListedAddons } from '~/lib/addons';
import listAddonsEndpoint from '~/endpoints/list-addons';
import type { AppContext } from '~/lib/context';
import { createApiClient } from '~/api/client';
import { encodeCursor } from '~/lib/keyset';
import { addon } from '~/db/schema';
import type { Api } from '~/api';

import { manifest, seedApprovedAddon, seedSubmission, seedVersion } from './helpers/addons';
import { createTestContext, signInWithDiscord } from './helpers/context';
import { failure, serveEndpoints } from './helpers/server';
import { explain, planNodes } from './helpers/database';

const base = await createTestContext({ ADDON_LIST_PAGE_SIZE: '2' });
const ctx = base.ctx;
const server = serveEndpoints(ctx, { 'GET /api/v1/addons': listAddonsEndpoint });
const client = createApiClient<Api>({ baseUrl: server.url.href });

afterAll(async () => {
	await server.stop(true);
	await base.close();
});

function onDay(day: number): AppContext {
	return { ...ctx, now: () => new Date(Date.UTC(2026, 9, day)) };
}

let ownerId = '';

beforeAll(async () => {
	({ userId: ownerId } = await signInWithDiscord(ctx, {
		id: '80351110224679001',
		name: 'Lister',
		email: 'lister@example.com',
	}));

	await seedApprovedAddon(
		onDay(1),
		ownerId,
		manifest('list.alpha', '1.0.0', { name: 'Alpha', description: 'Old description.' }),
	);
	await seedVersion(
		onDay(5),
		ownerId,
		manifest('list.alpha', '1.1.0', { name: 'Alpha', description: 'Adds reactions.' }),
	);
	// An older version approved later is not the newest, so it changes nothing listed.
	await seedVersion(
		onDay(6),
		ownerId,
		manifest('list.alpha', '1.0.1', { name: 'Alpha', description: 'Old description.' }),
	);
	await seedApprovedAddon(
		onDay(1),
		ownerId,
		manifest('list.able', '1.0.0', { name: 'Alpha', description: 'Another one.' }),
	);
	await seedApprovedAddon(
		onDay(2),
		ownerId,
		manifest('list.bravo', '1.0.0', {
			name: 'Bravo',
			description: 'A dark theme.',
			main: 'theme.json',
		}),
	);
	await seedApprovedAddon(
		onDay(3),
		ownerId,
		manifest('list.charlie', '1.0.0', {
			name: 'Charlie',
			description: 'Shows 100% of reactions.',
			type: 'plugin',
		}),
	);
	await seedApprovedAddon(
		onDay(4),
		ownerId,
		manifest('list.echo', '1.0.0', {
			name: 'Echo',
			description: 'A light theme.',
			type: 'theme',
		}),
	);
	await seedApprovedAddon(onDay(2), ownerId, manifest('list.delta', '1.0.0', { name: 'Delta' }));
	await ctx.db.update(addon).set({ delistedAt: new Date() }).where(eq(addon.id, 'list.delta'));
	await seedSubmission(ctx, ownerId, manifest('list.pending', '1.0.0', { name: 'Pending' }));
});

function list(query: ListAddonsQuery) {
	return client('GET /api/v1/addons', { query, response: listAddonsResponseSchema });
}

// Follows `nextCursor` to the end, returning each page's ids.
async function pages(query: ListAddonsQuery = {}): Promise<string[][]> {
	const result: string[][] = [];
	let cursor: string | undefined;

	do {
		const page = await list({ ...query, cursor });

		result.push(page.addons.map((entry) => entry.id));
		cursor = page.nextCursor ?? undefined;
	} while (cursor);

	return result;
}

async function ids(query: ListAddonsQuery = {}): Promise<string[]> {
	return (await pages(query)).flat();
}

describe('listing', () => {
	test('lists approved, listed addons with their newest version, two per page by name', async () => {
		const first = await list({});

		expect(
			first.addons.map((entry) => [entry.id, entry.type, entry.latestVersion.version]),
		).toEqual([
			['list.able', 'plugin', '1.0.0'],
			['list.alpha', 'plugin', '1.1.0'],
		]);
		expect(await pages()).toEqual([
			['list.able', 'list.alpha'],
			['list.bravo', 'list.charlie'],
			['list.echo'],
		]);
	});

	test.each<[AddonSort, SortOrder, string[]]>([
		['name', 'asc', ['list.able', 'list.alpha', 'list.bravo', 'list.charlie', 'list.echo']],
		['name', 'desc', ['list.echo', 'list.charlie', 'list.bravo', 'list.alpha', 'list.able']],
		['created', 'asc', ['list.able', 'list.alpha', 'list.bravo', 'list.charlie', 'list.echo']],
		['created', 'desc', ['list.echo', 'list.charlie', 'list.bravo', 'list.alpha', 'list.able']],
		['updated', 'asc', ['list.able', 'list.bravo', 'list.charlie', 'list.echo', 'list.alpha']],
		['updated', 'desc', ['list.alpha', 'list.echo', 'list.charlie', 'list.bravo', 'list.able']],
	])('pages by %s %s without skipping or repeating ties', async (sort, order, expected) => {
		expect(await ids({ sort, order })).toEqual(expected);
	});

	test('filters by type, taking an untyped manifest with a JSON main as a theme', async () => {
		expect(await ids({ type: 'plugin' })).toEqual(['list.able', 'list.alpha', 'list.charlie']);
		expect(await ids({ type: 'theme', sort: 'created', order: 'desc' })).toEqual([
			'list.echo',
			'list.bravo',
		]);
		expect(await ids({ type: 'font' })).toEqual([]);
	});

	test('searches the newest name and description case-insensitively, with literal wildcards', async () => {
		expect(await ids({ q: 'REACTIONS' })).toEqual(['list.alpha', 'list.charlie']);
		expect(await ids({ q: 'bravo' })).toEqual(['list.bravo']);
		expect(await ids({ q: '100%' })).toEqual(['list.charlie']);
		expect(await ids({ q: '_' })).toEqual([]);
		expect(await ids({ q: 'old description' })).toEqual([]);
		expect(await ids({ q: 'theme', type: 'theme', sort: 'name', order: 'desc' })).toEqual([
			'list.echo',
			'list.bravo',
		]);
	});

	test('never lists delisted addons or unapproved listings', async () => {
		expect(await ids({ q: 'delta' })).toEqual([]);
		expect(await ids({ q: 'pending' })).toEqual([]);
	});

	test('refuses a cursor that is malformed or from another sort', async () => {
		const { nextCursor } = await list({ sort: 'name' });

		expect(await failure(list({ cursor: 'not-a-cursor' }))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
		expect(await failure(list({ sort: 'created', cursor: nextCursor ?? undefined }))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
	});

	test.each<AddonSort>(['created', 'updated'])(
		'refuses a %s cursor whose time no Date can hold',
		async (sort) => {
			const cursor = encodeCursor([Number.MAX_SAFE_INTEGER, 'list.alpha']);

			expect(await failure(list({ sort, cursor }))).toEqual({
				status: 400,
				code: 'invalid_request',
			});
		},
	);

	test.each<ListAddonsQuery>([
		{ sort: 'name' },
		{ sort: 'created', order: 'desc' },
		{ sort: 'updated' },
		{ type: 'plugin', sort: 'name', order: 'desc' },
		{ type: 'theme', sort: 'created' },
		{ type: 'plugin', sort: 'updated', q: 'a' },
	])('reads %o in index order without sorting', async (query) => {
		const { nextCursor } = await list(query);
		const sql = queryListedAddons(ctx, { ...query, cursor: nextCursor ?? undefined }).toSQL();
		const nodes = planNodes(await explain(ctx.db, sql));

		expect(nodes.map((node) => node['Index Name'])).toContainEqual(
			expect.stringMatching(/^addon_listed_/),
		);
		expect(nodes.map((node) => node['Node Type'])).not.toContainEqual(
			expect.stringMatching(/Sort|Seq Scan/),
		);
	});
});

describe('addon details', () => {
	test('returns every version newest first and the maintainers', async () => {
		const details = await getAddonDetails(ctx, 'list.alpha');

		expect(details?.type).toBe('plugin');
		expect(details?.versions.map((version) => version.version)).toEqual([
			'1.1.0',
			'1.0.1',
			'1.0.0',
		]);
		expect(details?.versions[0]?.manifestUrl).toBe(
			`${ctx.env.CDN_URL}/addons/list.alpha/1.1.0/manifest.json`,
		);
		expect(details?.maintainers.map((member) => [member.id, member.role])).toEqual([
			[ownerId, 'owner'],
		]);
	});

	test('hides delisted and unapproved addons', async () => {
		expect(await getAddonDetails(ctx, 'list.delta')).toBeUndefined();
		expect(await getAddonDetails(ctx, 'list.pending')).toBeUndefined();
	});
});
