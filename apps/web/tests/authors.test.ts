import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { refreshDiscordProfiles, startProfileRefresher } from '~/lib/authors/profiles';
import type { DiscordId } from '~/lib/authors/discord-users';
import type { ManifestAuthor } from '~/lib/authors/resolve';
import { loadAuthors } from '~/lib/authors/resolve';
import { discordProfile, user } from '~/db/schema';
import type { AppContext } from '~/lib/context';

import { createTestContext, signInWithDiscord } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';
import { serveDiscord } from './helpers/discord';

const LINKED = '175928847299117063';
const PROFILED = '80351110224678912';
const UNFETCHED = '222222222222222222';
const UNKNOWN = '333333333333333333';
const LATE = '444444444444444444';
const BANNED = '555555555555555555';

const discord = serveDiscord({
	[LINKED]: { username: 'linked', global_name: 'Linked On Discord', avatar: 'abc' },
	[PROFILED]: { username: 'profiled', global_name: 'Profiled', avatar: 'a_anim' },
	[LATE]: { username: 'late', global_name: null },
	[BANNED]: { username: 'banned', global_name: 'Banned On Discord' },
});
const base = createTestContext({ DISCORD_API_URL: discord.apiUrl });
const ctx: AppContext = base.ctx;

afterAll(async () => {
	base.close();
	await discord.stop();
});

const AUTHORS: ManifestAuthor[] = [
	{ name: 'Manifest Linked', id: LINKED },
	{ name: 'Manifest Profiled', id: PROFILED },
	{ name: 'Manifest Unknown', id: UNKNOWN },
	{ name: 'Manifest Zero', id: '0' },
	{ name: 'Manifest Late', id: LATE },
	{ name: 'Manifest Banned', id: BANNED },
];

async function resolve(authors: ManifestAuthor[]) {
	const resolver = await loadAuthors(ctx, [authors]);

	return resolver(authors);
}

async function resolveOne(name: string, id: DiscordId) {
	const [author] = await resolve([{ name, id }]);

	return author;
}

describe('loadAuthors', () => {
	test('prefers a linked user, then the Discord profile, then the manifest', async () => {
		const owner = await signInWithDiscord(ctx, {
			id: LINKED,
			name: 'Unbound Name',
			email: 'linked@example.com',
		});
		const banned = await signInWithDiscord(ctx, {
			id: BANNED,
			name: 'Banned Unbound Name',
			email: 'banned@example.com',
		});

		await ctx.db.update(user).set({ banned: true }).where(eq(user.id, banned.userId));
		await seedApprovedAddon(
			ctx,
			owner.userId,
			manifest('authors.plugin', '1.0.0', { authors: AUTHORS }),
		);
		await refreshDiscordProfiles(ctx);

		expect(await resolve(AUTHORS)).toEqual([
			{
				kind: 'user',
				discordId: LINKED,
				userId: owner.userId,
				name: 'Unbound Name',
				avatarUrl: `https://cdn.discordapp.com/avatars/${LINKED}/abc.png`,
				role: 'developer',
				badge: null,
				memberSince: expect.any(String),
			},
			{
				kind: 'discord',
				discordId: PROFILED,
				username: 'profiled',
				name: 'Profiled',
				avatarUrl: `https://cdn.discordapp.com/avatars/${PROFILED}/a_anim.gif`,
			},
			{
				kind: 'manifest',
				discordId: UNKNOWN,
				name: 'Manifest Unknown',
				avatarUrl: 'https://cdn.discordapp.com/embed/avatars/4.png',
			},
			{
				kind: 'manifest',
				discordId: null,
				name: 'Manifest Zero',
				avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
			},
			{
				kind: 'discord',
				discordId: LATE,
				username: 'late',
				name: 'late',
				avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
			},
			{
				kind: 'discord',
				discordId: BANNED,
				username: 'banned',
				name: 'Banned On Discord',
				avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
			},
		]);
	});

	test('a user who links their Discord account later wins without a migration', async () => {
		expect(await resolveOne('Manifest Late', LATE)).toMatchObject({
			kind: 'discord',
			name: 'late',
		});

		const late = await signInWithDiscord(ctx, {
			id: LATE,
			name: 'Signed Up Later',
			email: 'late@example.com',
		});

		expect(await resolveOne('Manifest Late', LATE)).toMatchObject({
			kind: 'user',
			userId: late.userId,
			name: 'Signed Up Later',
		});
	});

	test('an id that was never fetched shows the manifest name and default avatar', async () => {
		expect(await resolveOne('Never Fetched', UNFETCHED)).toEqual({
			kind: 'manifest',
			discordId: UNFETCHED,
			name: 'Never Fetched',
			avatarUrl: 'https://cdn.discordapp.com/embed/avatars/3.png',
		});
	});

	test('treats a malformed id like an unknown one', async () => {
		for (const id of ['007', '99999999999999999999999']) {
			expect(await resolveOne('Malformed', id as typeof UNFETCHED)).toEqual({
				kind: 'manifest',
				discordId: null,
				name: 'Malformed',
				avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
			});
		}
	});

	test('keeps the first name of an author listed twice', async () => {
		const [author] = await resolve([
			{ name: 'First', id: UNFETCHED },
			{ name: 'Second', id: UNFETCHED },
		]);

		expect(author?.name).toBe('First');
	});

	test('lists an author named twice in one manifest once', async () => {
		const authors = await resolve([
			{ name: 'Manifest Profiled', id: PROFILED },
			{ name: 'Again', id: PROFILED },
			{ name: 'Anon', id: '0' },
			{ name: 'Anon', id: '0' },
			{ name: 'Other Anon', id: '0' },
		]);

		expect(authors.map((author) => author.name)).toEqual(['Profiled', 'Anon', 'Other Anon']);
	});

	test('returns cached data at once while Discord hangs', async () => {
		await ctx.db
			.update(discordProfile)
			.set({ fetchedAt: new Date(0) })
			.where(eq(discordProfile.discordId, PROFILED));
		discord.override(() => new Promise<Response>(() => {}));
		discord.requests.length = 0;

		const refresher = startProfileRefresher(ctx);

		try {
			while (discord.requests.length === 0) {
				await Bun.sleep(5);
			}

			const started = performance.now();
			const authors = await resolve(AUTHORS);

			expect(performance.now() - started).toBeLessThan(500);
			expect(authors[1]).toMatchObject({ kind: 'discord', name: 'Profiled' });
			expect(authors[2]).toMatchObject({ kind: 'manifest', name: 'Manifest Unknown' });
		} finally {
			refresher.stop();
		}
	});
});
