import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { listDevelopers } from '~/lib/developers';
import { addon, user } from '~/db/schema';

import { createTestContext, signInWithDiscord } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';

const { ctx, close } = createTestContext({ DEVELOPER_LIST_PAGE_SIZE: '2' });

afterAll(close);

let users = 0;

async function signUp(name: string): Promise<string> {
	users += 1;

	const { userId } = await signInWithDiscord(ctx, {
		id: `8035111022468${String(users).padStart(4, '0')}`,
		name,
		email: `developer-${users}@example.com`,
	});

	return userId;
}

function names(search: string, page: number = 1) {
	return listDevelopers(ctx, { search, page }).then((result) =>
		result.developers.map((developer) => developer.name),
	);
}

beforeAll(async () => {
	const alice = await signUp('Alice');
	const erin = await signUp('Erin 100%');
	const frank = await signUp('Frank');
	const banned = await signUp('Mallory');
	const delisted = await signUp('Dana');

	await signUp('Carol');
	await seedApprovedAddon(ctx, alice, manifest('alice.plugin'));
	await seedApprovedAddon(ctx, erin, manifest('erin.plugin'));
	await seedApprovedAddon(ctx, frank, manifest('frank.plugin'));
	await seedApprovedAddon(ctx, banned, manifest('mallory.plugin'));
	await seedApprovedAddon(ctx, delisted, manifest('dana.plugin'));

	await ctx.db.update(user).set({ banned: true }).where(eq(user.id, banned));
	await ctx.db.update(addon).set({ delistedAt: new Date() }).where(eq(addon.id, 'dana.plugin'));
});

describe('listDevelopers', () => {
	test('lists maintainers of listed addons by name, excluding banned users and non-maintainers', async () => {
		const result = await listDevelopers(ctx, { search: '', page: 1 });

		expect(result.total).toBe(3);
		expect(result.pageSize).toBe(2);
		expect(result.developers).toEqual([
			{ id: expect.any(String), name: 'Alice', image: null, role: 'developer', badge: null },
			{
				id: expect.any(String),
				name: 'Erin 100%',
				image: null,
				role: 'developer',
				badge: null,
			},
		]);
		expect(await names('', 2)).toEqual(['Frank']);
	});

	test('searches names case-insensitively and treats LIKE wildcards literally', async () => {
		expect(await names('ALI')).toEqual(['Alice']);
		expect(await names('%')).toEqual(['Erin 100%']);
		expect(await names('_')).toEqual([]);
		expect(await names('dana')).toEqual([]);
	});
});
