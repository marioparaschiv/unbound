import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { getDeveloper, listDevelopers } from '~/lib/developers';
import type { ManifestAuthor } from '~/lib/authors/resolve';
import { addon } from '~/db/schema';

import { createTestContext, signInWithDiscord } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';

const ALICE = '100000000000000001';
const ERIN = '100000000000000002';
const FRANK = '100000000000000003';
const DANA = '100000000000000004';

const { ctx, close } = createTestContext({ DEVELOPER_LIST_PAGE_SIZE: '2' });

afterAll(close);

function names(search: string, page: number = 1) {
	return listDevelopers(ctx, { search, page }).then((result) =>
		result.developers.map((developer) => developer.author.name),
	);
}

async function publish(id: string, authors: ManifestAuthor[], ownerId: string) {
	await seedApprovedAddon(ctx, ownerId, manifest(id, '1.0.0', { authors }));
}

beforeAll(async () => {
	const ci = await signInWithDiscord(ctx, {
		id: '100000000000000099',
		name: 'Unbound CI',
		email: 'ci@example.com',
	});

	await signInWithDiscord(ctx, { id: FRANK, name: 'Franklin', email: 'frank@example.com' });
	await publish('alice.plugin', [{ name: 'Alice', id: ALICE }], ci.userId);
	await publish(
		'erin.plugin',
		[
			{ name: 'Erin 100%', id: ERIN },
			{ name: 'Ally', id: ALICE },
		],
		ci.userId,
	);
	await publish(
		'frank.plugin',
		[
			{ name: 'Frank', id: FRANK },
			{ name: 'Anon', id: '0' },
		],
		ci.userId,
	);
	await publish('dana.plugin', [{ name: 'Dana', id: DANA }], ci.userId);
	await ctx.db.update(addon).set({ delistedAt: new Date() }).where(eq(addon.id, 'dana.plugin'));
});

describe('listDevelopers', () => {
	test('lists the distinct credited authors of listed addons by name, not the publisher', async () => {
		const result = await listDevelopers(ctx, { search: '', page: 1 });

		expect(result.total).toBe(3);
		expect(result.pageSize).toBe(2);
		expect(
			result.developers.map(({ author, addonCount }) => [
				author.discordId,
				author.name,
				addonCount,
			]),
		).toEqual([
			[ALICE, 'Alice', 2],
			[ERIN, 'Erin 100%', 1],
		]);
		expect(await names('', 2)).toEqual(['Franklin']);
	});

	test('shows a linked account under its Unbound name', async () => {
		const [franklin] = (await listDevelopers(ctx, { search: 'frank', page: 1 })).developers;

		expect(franklin?.author).toMatchObject({
			kind: 'user',
			name: 'Franklin',
			discordId: FRANK,
		});
	});

	test('searches resolved and manifest names case-insensitively and literally', async () => {
		expect(await names('ALI')).toEqual(['Alice']);
		expect(await names('ally')).toEqual(['Alice']);
		expect(await names('%')).toEqual(['Erin 100%']);
		expect(await names('_')).toEqual([]);
		expect(await names('dana')).toEqual([]);
		expect(await names('anon')).toEqual([]);
	});
});

describe('getDeveloper', () => {
	test('loads the listed addons that credit an id', async () => {
		const developer = await getDeveloper(ctx, ALICE);

		expect(developer?.author).toMatchObject({ kind: 'manifest', name: 'Alice' });
		expect(developer?.addons.map((entry) => entry.id)).toEqual(['alice.plugin', 'erin.plugin']);
	});

	test('finds nothing for an id only a delisted addon credits, or for 0', async () => {
		expect(await getDeveloper(ctx, DANA)).toBeUndefined();
		expect(await getDeveloper(ctx, '0')).toBeUndefined();
	});
});
