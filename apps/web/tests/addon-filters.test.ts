import { listAddonsResponseSchema, type ListAddonsQuery } from '@unbound-app/contracts/addons';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import type { DiscordId } from '~/lib/authors/discord-users';
import { searchAuthors } from '~/lib/authors/directory';
import listAddonsEndpoint from '~/endpoints/list-addons';
import { addon, addonTag, tag } from '~/db/schema';
import type { AppContext } from '~/lib/context';
import { createApiClient } from '~/api/client';
import { listTags } from '~/lib/addon-tags';
import { listAddons } from '~/lib/addons';
import type { Api } from '~/api';

import { manifest, seedApprovedAddon, seedVersion } from './helpers/addons';
import { createTestContext, signInWithDiscord } from './helpers/context';
import { serveEndpoints } from './helpers/server';

const base = await createTestContext({ ADDON_LIST_PAGE_SIZE: '2' });
const ctx = base.ctx;
const server = serveEndpoints(ctx, { 'GET /api/v1/addons': listAddonsEndpoint });
const client = createApiClient<Api>({ baseUrl: server.url.href });

const ANA = '100000000000000001';
const BO = '100000000000000002';
const CY = '100000000000000003';

afterAll(async () => {
	await server.stop(true);
	await base.close();
});

function onDay(day: number): AppContext {
	return { ...ctx, now: () => new Date(Date.UTC(2026, 9, day)) };
}

type Seed = {
	id: string;
	day: number;
	tags: string[];
	authors: [name: string, id: DiscordId][];
	theme?: boolean;
};

const SEEDS: Seed[] = [
	{
		id: 'f.both',
		day: 1,
		tags: ['privacy', 'voice'],
		authors: [
			['Ana', ANA],
			['Bo', BO],
		],
	},
	{ id: 'f.privacy', day: 10, tags: ['privacy'], authors: [['Bo', BO]] },
	{
		id: 'f.plain',
		day: 25,
		tags: [],
		authors: [
			['Cy', CY],
			['Bo', BO],
		],
	},
	{ id: 'f.voice', day: 28, tags: ['voice', 'media'], authors: [['Annie', ANA]] },
	{ id: 'f.dark', day: 20, tags: ['voice'], authors: [['Ana', ANA]], theme: true },
	{ id: 'f.gone', day: 5, tags: ['privacy'], authors: [['Ana', ANA]] },
];

beforeAll(async () => {
	const { userId } = await signInWithDiscord(ctx, {
		id: '80351110224679002',
		name: 'Filterer',
		email: 'filterer@example.com',
	});

	await ctx.db.insert(tag).values([
		{ id: 'privacy', label: 'Privacy', color: '#10b981', position: 1 },
		{ id: 'voice', label: 'Voice', color: '#f97316', position: 2 },
		{ id: 'media', label: 'Media', color: '#ec4899', position: 3 },
		{ id: 'unused', label: 'Unused', color: '#94a3b8', position: 4 },
	]);

	for (const seed of SEEDS) {
		await seedApprovedAddon(
			onDay(seed.day),
			userId,
			manifest(seed.id, '1.0.0', {
				name: seed.id.slice(2),
				type: seed.theme ? 'theme' : 'plugin',
				authors: seed.authors.map(([name, id]) => ({ name, id })),
			}),
		);
	}

	// The newest version credits Cy alone, so only Cy is its author now.
	await seedApprovedAddon(
		onDay(2),
		userId,
		manifest('f.moved', '1.0.0', { name: 'moved', authors: [{ name: 'Ana', id: ANA }] }),
	);
	await seedVersion(
		onDay(29),
		userId,
		manifest('f.moved', '1.1.0', { name: 'moved', authors: [{ name: 'Cy', id: CY }] }),
	);

	await ctx.db
		.insert(addonTag)
		.values([
			...SEEDS.flatMap((seed) => seed.tags.map((tagId) => ({ addonId: seed.id, tagId }))),
			{ addonId: 'f.moved', tagId: 'media' },
		]);
	await ctx.db.update(addon).set({ delistedAt: new Date() }).where(eq(addon.id, 'f.gone'));
});

// Pages through the plugins as of October 30th, returning each page's ids.
async function pages(query: ListAddonsQuery = {}): Promise<string[][]> {
	const result: string[][] = [];
	let cursor: string | undefined;

	do {
		const page = await listAddons(onDay(30), { type: 'plugin', ...query, cursor });

		result.push(page.addons.map((entry) => entry.id));
		cursor = page.nextCursor ?? undefined;
	} while (cursor);

	return result;
}

async function ids(query: ListAddonsQuery = {}): Promise<string[]> {
	return (await pages(query)).flat();
}

describe('listing filters', () => {
	test.each<[ListAddonsQuery, string[]]>([
		[{ tags: 'voice' }, ['f.both', 'f.voice']],
		[{ tags: 'privacy,voice' }, ['f.both', 'f.privacy', 'f.voice']],
		[{ tags: 'privacy,voice', tagMatch: 'all' }, ['f.both']],
		[{ tags: 'voice,media', tagMatch: 'all' }, ['f.voice']],
		[{ tags: 'voice,voice', tagMatch: 'all' }, ['f.both', 'f.voice']],
		[{ tags: 'privacy,voice', tagMatch: 'none' }, ['f.moved', 'f.plain']],
		[{ tags: 'unused' }, []],
	])('tags %o', async (query, expected) => {
		expect(await ids(query)).toEqual(expected);
	});

	test.each<[ListAddonsQuery, string[]]>([
		[{ authors: ANA }, ['f.both', 'f.voice']],
		[{ authors: CY }, ['f.moved', 'f.plain']],
		[{ authors: `${ANA},${BO}` }, ['f.both', 'f.plain', 'f.privacy', 'f.voice']],
		[{ authors: ANA, authorMatch: 'none' }, ['f.moved', 'f.plain', 'f.privacy']],
	])('authors of the newest version %o', async (query, expected) => {
		expect(await ids(query)).toEqual(expected);
	});

	test.each<[ListAddonsQuery, string[]]>([
		[{ updated: '7' }, ['f.moved', 'f.plain', 'f.voice']],
		[{ updated: '7', updatedMatch: 'none' }, ['f.both', 'f.privacy']],
		[{ updated: '30' }, ['f.both', 'f.moved', 'f.plain', 'f.privacy', 'f.voice']],
	])('updated %o', async (query, expected) => {
		expect(await ids(query)).toEqual(expected);
	});

	test('ANDs every filter with the type and search', async () => {
		expect(await ids({ tags: 'privacy', authors: BO, updated: '30' })).toEqual([
			'f.both',
			'f.privacy',
		]);
		expect(await ids({ tags: 'privacy', authors: BO, updated: '21' })).toEqual(['f.privacy']);
		expect(await ids({ tags: 'voice', q: 'voi' })).toEqual(['f.voice']);
		expect(await ids({ type: 'theme', tags: 'voice', authors: ANA })).toEqual(['f.dark']);
	});

	test('pages a filtered list in sort order without skipping or repeating', async () => {
		expect(await pages({ tags: 'privacy,voice' })).toEqual([
			['f.both', 'f.privacy'],
			['f.voice'],
		]);
		expect(await ids({ tags: 'media', sort: 'updated', order: 'desc' })).toEqual([
			'f.moved',
			'f.voice',
		]);
	});

	test('takes the filters over the public API and refuses malformed ones', async () => {
		const list = (query: ListAddonsQuery) =>
			client('GET /api/v1/addons', { query, response: listAddonsResponseSchema });
		const page = await list({ type: 'plugin', tags: 'privacy,voice', tagMatch: 'all' });

		expect(page.addons.map((entry) => entry.id)).toEqual(['f.both']);

		for (const query of [
			'tags=Privacy',
			'tags=privacy,',
			'authors=ana',
			'updated=0',
			'authorMatch=all',
		]) {
			const response = await fetch(new URL(`/api/v1/addons?${query}`, server.url));

			expect([query, response.status]).toEqual([query, 400]);
		}
	});
});

describe('tags', () => {
	test('counts the listed addons of the type carrying each tag, in menu order', async () => {
		const counts = (tags: Awaited<ReturnType<typeof listTags>>) =>
			tags.map((entry) => [entry.id, entry.count]);

		expect(counts(await listTags(ctx, 'plugin'))).toEqual([
			['privacy', 2],
			['voice', 2],
			['media', 2],
			['unused', 0],
		]);
		expect(counts(await listTags(ctx, 'theme'))).toEqual([
			['privacy', 0],
			['voice', 1],
			['media', 0],
			['unused', 0],
		]);
	});
});

describe('author directory', () => {
	test('lists the newest versions’ authors, most addons first', async () => {
		const page = await searchAuthors(ctx, { type: 'plugin' });

		expect(page.authors.map((author) => [author.id, author.name, author.count])).toEqual([
			[BO, 'Bo', 3],
			[ANA, 'Ana', 2],
			[CY, 'Cy', 2],
		]);
		expect([page.total, page.nextCursor]).toEqual([3, null]);
	});

	test('searches the shown name and every name a manifest credits', async () => {
		const names = async (q: string) =>
			(await searchAuthors(ctx, { type: 'plugin', q })).authors.map((author) => author.id);

		expect(await names('CY')).toEqual([CY]);
		expect(await names('annie')).toEqual([ANA]);
		expect(await names('zed')).toEqual([]);
	});

	test('counts per type and looks authors up by id', async () => {
		const themes = await searchAuthors(ctx, { type: 'theme' });
		const picked = await searchAuthors(ctx, { ids: [CY] });

		expect(themes.authors.map((author) => [author.id, author.count])).toEqual([[ANA, 1]]);
		expect(picked.authors.map((author) => author.id)).toEqual([CY]);
	});
});
