import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import {
	readProfiles,
	refreshDiscordProfiles,
	requestProfileRefresh,
	startProfileRefresher,
} from '~/lib/authors/profiles';
import { fetchDiscordUser } from '~/lib/authors/discord-users';
import type { DiscordId } from '~/lib/authors/discord-users';
import { addon, discordProfile } from '~/db/schema';
import type { AppContext } from '~/lib/context';
import { parseEnv } from '~/lib/env';

import {
	OFFLINE_DATABASE_ENV,
	TEST_ENV,
	createTestContext,
	signInWithDiscord,
} from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';
import { serveDiscord } from './helpers/discord';

const HOUR_MS = 3_600_000;

const discord = serveDiscord();
const other = serveDiscord();
const base = await createTestContext({ DISCORD_API_URL: discord.apiUrl });

let clock = new Date('2026-10-20T12:00:00Z');

const ctx: AppContext = { ...base.ctx, now: () => clock };

let addons = 0;
let ownerId = '';

afterAll(async () => {
	await base.close();
	await Promise.all([discord.stop(), other.stop()]);
});

afterEach(() => {
	discord.override(null);
	discord.requests.length = 0;
	other.requests.length = 0;
});

beforeAll(async () => {
	const { userId } = await signInWithDiscord(ctx, {
		id: '900000000000000001',
		name: 'Owner',
		email: 'owner@example.com',
	});

	await seedApprovedAddon(
		ctx,
		userId,
		manifest('delisted.plugin', '1.0.0', { authors: [{ name: 'Gone', id: '700' }] }),
	);
	await ctx.db.update(addon).set({ delistedAt: clock }).where(eq(addon.id, 'delisted.plugin'));

	ownerId = userId;
});

async function credit(...ids: DiscordId[]) {
	addons += 1;
	await seedApprovedAddon(
		ctx,
		ownerId,
		manifest(`profiles${addons}.plugin`, '1.0.0', {
			authors: ids.map((id) => ({ name: `Author ${id}`, id })),
		}),
	);
}

async function cache(id: DiscordId, username: string, ageMs: number) {
	await ctx.db.insert(discordProfile).values({
		discordId: id,
		username,
		globalName: null,
		avatarHash: null,
		fetchedAt: new Date(clock.getTime() - ageMs),
	});
}

function fetchedIds() {
	return discord.requests.map((request) => request.path.split('/').at(-1) ?? '');
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs: number = 2000) {
	const deadline = Date.now() + timeoutMs;

	while (!(await predicate())) {
		if (Date.now() > deadline) {
			throw new Error('Timed out waiting for the condition.');
		}

		await Bun.sleep(5);
	}
}

describe('refreshDiscordProfiles', () => {
	test('fetches missing and stale profiles, never fresh ones, unknown ids or delisted authors', async () => {
		discord.users.set('101', { username: 'fresh-new' });
		discord.users.set('102', { username: 'stale-new', global_name: 'Stale', avatar: 'a_hash' });
		discord.users.set('103', { username: 'missing-new' });
		await cache('101', 'fresh-old', HOUR_MS);
		await cache('102', 'stale-old', 25 * HOUR_MS);
		await credit('101', '102', '103', '0');

		const result = await refreshDiscordProfiles(ctx);
		const profiles = await readProfiles(ctx, ['101', '102', '103']);

		expect(fetchedIds().toSorted((a, b) => a.localeCompare(b))).toEqual(['102', '103']);
		expect(result).toEqual({ refreshed: 2, retryAfterMs: null });
		expect(profiles.get('101')).toMatchObject({
			kind: 'found',
			user: { username: 'fresh-old' },
		});
		const refreshed = profiles.get('102');

		expect(refreshed).toMatchObject({
			kind: 'found',
			user: { id: '102', username: 'stale-new', globalName: 'Stale', avatarHash: 'a_hash' },
		});
		// toMatchObject ignores Date values, so the fetch time is pinned on its own.
		expect(refreshed?.fetchedAt).toEqual(clock);
		expect(profiles.get('103')).toMatchObject({
			kind: 'found',
			user: { username: 'missing-new' },
		});
	});

	test('caches a 404 as a miss and does not fetch it again while fresh', async () => {
		await credit('201');

		await refreshDiscordProfiles(ctx);
		await refreshDiscordProfiles(ctx);

		expect(fetchedIds()).toEqual(['201']);
		expect((await readProfiles(ctx, ['201'])).get('201')).toEqual({
			kind: 'missing',
			discordId: '201',
			fetchedAt: clock,
		});
	});

	test('never looks up malformed ids, and caches a 400 as a miss so it cannot stall the sweep', async () => {
		await credit('007', '99999999999999999999999', '251', '252', '253');
		discord.override((id) =>
			id === '251'
				? Response.json({ message: 'Invalid Form Body' }, { status: 400 })
				: undefined,
		);

		const result = await refreshDiscordProfiles(ctx);

		expect(fetchedIds().toSorted((a, b) => a.localeCompare(b))).toEqual(['251', '252', '253']);
		expect(result).toEqual({ refreshed: 3, retryAfterMs: null });
		expect((await readProfiles(ctx, ['251'])).get('251')?.kind).toBe('missing');
	});

	test('keeps the cached row when Discord answers 500', async () => {
		await cache('301', 'kept', 30 * HOUR_MS);
		await credit('301');
		discord.override(() => Response.json({ message: 'Oops' }, { status: 500 }));

		const result = await refreshDiscordProfiles(ctx);

		expect(result.retryAfterMs).toBeGreaterThan(0);
		expect(fetchedIds()).toContain('301');
		expect((await readProfiles(ctx, ['301'])).get('301')).toEqual({
			kind: 'found',
			user: { id: '301', username: 'kept', globalName: null, avatarHash: null },
			fetchedAt: new Date(clock.getTime() - 30 * HOUR_MS),
		});
	});

	test('stops at a 429 without writing the limited id or fetching the rest', async () => {
		clock = new Date(clock.getTime() + 48 * HOUR_MS);
		await refreshDiscordProfiles(ctx);
		discord.requests.length = 0;
		await credit('401', '402', '403');

		let calls = 0;

		discord.override(() => {
			calls += 1;

			return calls === 2
				? Response.json(
						{ message: 'You are being rate limited.', retry_after: 1.5 },
						{ status: 429 },
					)
				: undefined;
		});

		const result = await refreshDiscordProfiles(ctx);
		const [first, limited] = fetchedIds();
		const profiles = await readProfiles(ctx, ['401', '402', '403']);

		expect(result).toEqual({ refreshed: 1, retryAfterMs: 1500 });
		expect(fetchedIds()).toHaveLength(2);
		expect(profiles.has(first as DiscordId)).toBe(true);
		expect(profiles.has(limited as DiscordId)).toBe(false);
		expect(profiles.size).toBe(1);
	});

	test('sends the bot token with every request', async () => {
		clock = new Date(clock.getTime() + 48 * HOUR_MS);
		await refreshDiscordProfiles(ctx);

		expect(discord.requests.length).toBeGreaterThan(0);

		for (const request of discord.requests) {
			expect(request.authorization).toBe(`Bot ${TEST_ENV.DISCORD_BOT_TOKEN}`);
		}
	});

	test('does not follow a redirect to another host', async () => {
		await credit('501');
		discord.override(() => Response.redirect(new URL('/api/v10/users/501', other.url), 302));

		await refreshDiscordProfiles(ctx);

		expect(fetchedIds()).toContain('501');
		expect(other.requests).toEqual([]);
		expect((await readProfiles(ctx, ['501'])).has('501')).toBe(false);
	});
});

describe('Discord API host', () => {
	test('rejects a DISCORD_API_URL that is neither discord.com nor loopback', () => {
		const env = { ...TEST_ENV, ...OFFLINE_DATABASE_ENV };

		for (const url of [
			'https://example.com/api/v10',
			'http://discord.com/api/v10',
			'not a url',
		]) {
			expect(() => parseEnv({ ...env, DISCORD_API_URL: url })).toThrow(/DISCORD_API_URL/);
		}

		expect(parseEnv(env).DISCORD_API_URL).toBe('https://discord.com/api/v10');
	});

	test('never sends the token to another host, even with an unchecked environment', async () => {
		const fetchSpy = spyOn(globalThis, 'fetch');

		try {
			const env = { ...ctx.env, DISCORD_API_URL: 'https://discord.example.com/api/v10' };

			const error = await fetchDiscordUser(env, '601').then(
				() => undefined,
				(caught) => caught,
			);

			expect(String(error)).toMatch(/Refusing to send the Discord bot token/);
			expect(fetchSpy).not.toHaveBeenCalled();
		} finally {
			fetchSpy.mockRestore();
		}
	});
});

describe('startProfileRefresher', () => {
	test('pauses on a 429, ignores requests until retry_after, then resumes', async () => {
		clock = new Date(clock.getTime() + 48 * HOUR_MS);
		await credit('801');

		let limited = false;

		discord.override(() => {
			if (limited) return;

			limited = true;

			return Response.json({ retry_after: 0.2 }, { status: 429 });
		});

		const refresher = startProfileRefresher(ctx);

		try {
			await waitFor(() => discord.requests.length === 1);
			requestProfileRefresh();
			await Bun.sleep(50);

			// A retry_after under a second is held to one, so this pause is still running.
			expect(discord.requests).toHaveLength(1);

			await waitFor(async () => (await readProfiles(ctx, ['801'])).has('801'), 4000);

			expect(discord.requests.length).toBeGreaterThan(1);
		} finally {
			refresher.stop();
		}
	});

	test('does nothing on request when no refresher was started', async () => {
		await credit('901');
		requestProfileRefresh();
		await Bun.sleep(20);

		expect(discord.requests.map((request) => request.path)).not.toContain('/api/v10/users/901');
	});
});
