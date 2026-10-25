import {
	botAddonsResponseSchema,
	botEventsResponseSchema,
	botMembersResponseSchema,
	botReleasesResponseSchema,
} from '@unbound-app/contracts/bot';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import { account, addon, addonMaintainer, moderationEvent, user } from '~/db/schema';
import { publishLoaderRelease, withdrawLoaderRelease } from '~/lib/loader-releases';
import { API_KEY_HEADER, createApiClient } from '~/api/client';
import botReleases from '~/endpoints/bot-releases';
import { mintBotKey } from '~/lib/bot/credential';
import botMembers from '~/endpoints/bot-members';
import { resolveCaller } from '~/lib/api/caller';
import botAddons from '~/endpoints/bot-addons';
import botEvents from '~/endpoints/bot-events';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';
import { delistAddon } from '~/lib/addons';
import type { Api } from '~/api';

import { createTestContext, linkGitHub, signInWithDiscord, snowflakeAt } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';
import { failure, serveEndpoints } from './helpers/server';
import { seedSponsorship } from './helpers/sponsors';

type Page<T> = {
	items: T[];
	cursor: string | null;
	hasMore: boolean;
};

type Drained<T> = {
	items: T[];
	cursor: string | null;
	pages: number;
};

type Reader<T> = (after?: string, limit?: string) => Promise<Page<T>>;

type HeaderValues = ConstructorParameters<typeof Headers>[0];

const { ctx, close } = createTestContext();
const server = serveEndpoints(ctx, {
	'GET /api/v1/bot/addons': botAddons,
	'GET /api/v1/bot/members': botMembers,
	'GET /api/v1/bot/releases': botReleases,
	'GET /api/v1/bot/events': botEvents,
});

let botKey = '';

beforeAll(async () => {
	botKey = await mintBotKey(ctx);
});

afterAll(async () => {
	await server.stop(true);
	close();
});

let users = 0;

async function signUp(role: Role = 'user') {
	users += 1;

	const discordId = snowflakeAt(new Date(Date.UTC(2020, 0, users)));
	const { userId, headers } = await signInWithDiscord(ctx, {
		id: discordId,
		name: `Member ${users}`,
		email: `bot-feed-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	const caller: Caller = { user: row, via: 'session' };

	return { userId, discordId, headers, caller };
}

/** Reads each feed as the bot does, or with the given credentials instead of the bot's key. */
function readers(headers?: HeaderValues) {
	function request() {
		return createApiClient<Api>({
			baseUrl: server.url.href,
			headers: headers ?? { [API_KEY_HEADER]: botKey },
		});
	}

	return {
		addons: (after?: string, limit?: string) =>
			request()('GET /api/v1/bot/addons', {
				query: { after, limit },
				response: botAddonsResponseSchema,
			}),
		members: (after?: string, limit?: string) =>
			request()('GET /api/v1/bot/members', {
				query: { after, limit },
				response: botMembersResponseSchema,
			}),
		releases: (after?: string, limit?: string) =>
			request()('GET /api/v1/bot/releases', {
				query: { after, limit },
				response: botReleasesResponseSchema,
			}),
		events: (after?: string, limit?: string) =>
			request()('GET /api/v1/bot/events', {
				query: { after, limit },
				response: botEventsResponseSchema,
			}),
	} satisfies Record<string, Reader<object>>;
}

const feeds = readers();

async function drain<T>(
	read: Reader<T>,
	after: string | null = null,
	limit: string = '2',
): Promise<Drained<T>> {
	const items: T[] = [];
	let cursor = after;
	let pages = 0;
	let more = true;

	while (more) {
		const page = await read(cursor ?? undefined, limit);

		items.push(...page.items);
		cursor = page.cursor;
		pages += 1;
		more = page.hasMore;
	}

	return { items, cursor, pages };
}

async function tail<T>(read: Reader<T>): Promise<string | null> {
	return (await drain(read, null, '500')).cursor;
}

function seedAddon(ownerId: string, id: string, overrides: Partial<PublishedManifest> = {}) {
	return seedApprovedAddon(ctx, ownerId, manifest(id, '1.0.0', overrides));
}

describe('access', () => {
	test('an anonymous caller is unauthorized and an ordinary user forbidden', async () => {
		const member = await signUp();
		const moderator = await signUp('moderator');

		const callers = [
			[readers({}), { status: 401, code: 'unauthorized' }],
			[readers(member.headers), { status: 403, code: 'forbidden' }],
			[readers(moderator.headers), { status: 403, code: 'forbidden' }],
		] as const;

		for (const [read, refused] of callers) {
			for (const feed of Object.values(read)) {
				expect(await failure(feed())).toEqual(refused);
			}
		}
	});

	test('the minted key resolves to the bot user through the API key header', async () => {
		const caller = await resolveCaller(ctx, new Headers({ [API_KEY_HEADER]: botKey }));

		expect(caller).toMatchObject({
			via: 'api-key',
			user: { name: 'Unbound Bot', email: 'bot@unbound.invalid', role: 'bot' },
		});

		const second = await mintBotKey(ctx);
		const again = await resolveCaller(ctx, new Headers({ [API_KEY_HEADER]: second }));

		expect(second).not.toBe(botKey);
		expect(again?.user.id).toBe(caller?.user.id);
	});

	test('an admin session reads the feeds too', async () => {
		const admin = await signUp('admin');

		expect(await readers(admin.headers).releases()).toMatchObject({ hasMore: false });
	});
});

describe('addons feed', () => {
	test('pages every changed addon in change order, then stays at the end', async () => {
		const owner = await signUp();
		const from = await tail(feeds.addons);

		await seedAddon(owner.userId, 'feed.first', { icon: 'https://cdn.example.com/a.png' });
		await seedAddon(owner.userId, 'feed.second', { icon: { uri: 'data:image/png;base64,AA' } });
		await seedAddon(owner.userId, 'feed.third');

		const drained = await drain(feeds.addons, from);

		expect(drained.pages).toBe(2);
		expect(drained.items.map((item) => item.id)).toEqual([
			'feed.first',
			'feed.second',
			'feed.third',
		]);
		expect(drained.items[0]).toEqual({
			id: 'feed.first',
			type: 'plugin',
			name: 'Hello',
			description: 'Says hello.',
			version: '1.0.0',
			authors: [{ name: 'Mario', discordId: '1234567890' }],
			iconUrl: 'https://cdn.example.com/a.png',
			pageUrl: 'http://localhost:3000/addons/feed.first',
			listed: true,
			updatedAt: expect.any(String),
		});
		expect(drained.items[1]).not.toHaveProperty('iconUrl');

		const empty = await feeds.addons(drained.cursor ?? undefined, '2');

		expect(empty).toEqual({ items: [], cursor: drained.cursor, hasMore: false });
	});

	test('an addon changed while paging moves to a later page instead of being skipped', async () => {
		const owner = await signUp();
		const from = await tail(feeds.addons);

		for (const id of ['moving.a', 'moving.b', 'moving.c', 'moving.d']) {
			await seedAddon(owner.userId, id);
		}

		const first = await feeds.addons(from ?? undefined, '2');

		await ctx.db.update(addon).set({ name: 'Renamed C' }).where(eq(addon.id, 'moving.c'));
		await ctx.db.update(addon).set({ name: 'Renamed A' }).where(eq(addon.id, 'moving.a'));

		const rest = await drain(feeds.addons, first.cursor);

		expect(first.items.map((item) => item.id)).toEqual(['moving.a', 'moving.b']);
		expect(rest.items.map((item) => [item.id, item.name])).toEqual([
			['moving.d', 'Hello'],
			['moving.c', 'Renamed C'],
			['moving.a', 'Renamed A'],
		]);
	});

	test('a delist shows the addon as unlisted with a fresh time', async () => {
		const owner = await signUp();
		const moderator = await signUp('moderator');

		await seedAddon(owner.userId, 'feed.delisted');

		const from = await tail(feeds.addons);
		const before = Date.now();

		delistAddon(ctx, moderator.caller, 'feed.delisted');

		const { items } = await drain(feeds.addons, from);

		expect(items).toMatchObject([{ id: 'feed.delisted', listed: false }]);
		expect(Date.parse(items[0]?.updatedAt ?? '')).toBeGreaterThanOrEqual(before - 1);
	});
});

describe('members feed', () => {
	test('signing up, linking GitHub and sponsoring each move the member past the cursor', async () => {
		let from = await tail(feeds.members);
		const member = await signUp();

		expect((await drain(feeds.members, from)).items).toEqual([
			{
				userId: member.userId,
				discordId: member.discordId,
				isAddonDeveloper: false,
				isSponsor: false,
				updatedAt: expect.any(String),
			},
		]);

		from = await tail(feeds.members);
		await linkGitHub(ctx, member.userId, 'token');
		seedSponsorship(ctx, { githubId: member.userId });

		expect((await drain(feeds.members, from)).items).toMatchObject([
			{
				userId: member.userId,
				githubId: member.userId,
				githubLogin: `sponsor-${member.userId}`,
				isSponsor: true,
			},
		]);
	});

	test('maintaining a listed addon makes a developer; a delist or removal undoes it', async () => {
		const owner = await signUp();
		const helper = await signUp();
		const moderator = await signUp('moderator');
		let from = await tail(feeds.members);

		await seedAddon(owner.userId, 'members.addon');
		await ctx.db
			.insert(addonMaintainer)
			.values({ addonId: 'members.addon', userId: helper.userId, role: 'maintainer' });

		const developers = await drain(feeds.members, from);

		expect(developers.items.map((item) => [item.userId, item.isAddonDeveloper])).toEqual([
			[owner.userId, true],
			[helper.userId, true],
		]);

		from = developers.cursor;
		await ctx.db
			.delete(addonMaintainer)
			.where(
				and(
					eq(addonMaintainer.addonId, 'members.addon'),
					eq(addonMaintainer.userId, helper.userId),
				),
			);
		delistAddon(ctx, moderator.caller, 'members.addon');

		const undone = await drain(feeds.members, from);

		expect(undone.items.map((item) => [item.userId, item.isAddonDeveloper])).toEqual([
			[helper.userId, false],
			[owner.userId, false],
		]);
	});

	test('unlinking Discord and deleting the user each read as no Discord id', async () => {
		const unlinked = await signUp();
		const deleted = await signUp();

		await seedAddon(unlinked.userId, 'members.unlinked');

		const from = await tail(feeds.members);

		await ctx.db
			.delete(account)
			.where(and(eq(account.userId, unlinked.userId), eq(account.providerId, 'discord')));
		await ctx.db.delete(user).where(eq(user.id, deleted.userId));

		const tombstone = { discordId: null, isAddonDeveloper: false, isSponsor: false };

		expect((await drain(feeds.members, from)).items).toMatchObject([
			{ userId: unlinked.userId, ...tombstone },
			{ userId: deleted.userId, ...tombstone },
		]);
	});
});

describe('releases feed', () => {
	test('publishes in order, skips a withdrawn release and shows a republish again', async () => {
		const ci = await signUp('ci');
		const release = (platform: 'ios' | 'android', url: string) =>
			publishLoaderRelease(ctx, ci.caller, { platform, version: '3.0.0', url });
		const from = await tail(feeds.releases);

		await release('ios', 'https://example.com/ios');
		await release('android', 'https://example.com/android');

		const published = await drain(feeds.releases, from);

		expect(published.items.map((item) => [item.platform, item.url])).toEqual([
			['ios', 'https://example.com/ios'],
			['android', 'https://example.com/android'],
		]);

		await withdrawLoaderRelease(ctx, ci.caller, 'ios', '3.0.0');

		const withdrawn = await feeds.releases(published.cursor ?? undefined, '2');

		expect(withdrawn.items).toEqual([]);
		expect(withdrawn.cursor).not.toBe(published.cursor);

		await release('android', 'https://example.com/android-2');

		expect((await drain(feeds.releases, withdrawn.cursor)).items).toMatchObject([
			{ platform: 'android', url: 'https://example.com/android-2' },
		]);
	});
});

describe('events feed', () => {
	test('pages the log oldest first, naming subjects and skipping rows that no longer parse', async () => {
		const owner = await signUp();
		const moderator = await signUp('moderator');

		await seedAddon(owner.userId, 'events.feed');

		const from = await tail(feeds.events);
		const event = {
			subjectType: 'addon',
			subjectId: 'events.feed',
			actorId: moderator.userId,
			data: {},
			createdAt: new Date(),
		} as const;

		await ctx.db.insert(moderationEvent).values({ ...event, kind: 'addon.delisted' });
		await ctx.db.insert(moderationEvent).values({ ...event, kind: 'review.decided' });
		await ctx.db.insert(moderationEvent).values({ ...event, kind: 'addon.relisted' });
		await ctx.db
			.insert(moderationEvent)
			.values({ ...event, subjectType: 'user', subjectId: 'gone', kind: 'user.unbanned' });

		const drained = await drain(feeds.events, from);

		expect(drained.pages).toBe(2);
		expect(drained.items).toEqual([
			{
				id: expect.any(Number),
				kind: 'addon.delisted',
				subjectType: 'addon',
				subjectId: 'events.feed',
				subjectName: 'Hello',
				actor: { id: moderator.userId, name: moderator.caller.user.name },
				data: {},
				reason: null,
				createdAt: event.createdAt.toISOString(),
			},
			expect.objectContaining({ kind: 'addon.relisted' }),
			expect.not.objectContaining({ subjectName: expect.anything() }),
		]);
		expect((await feeds.events(drained.cursor ?? undefined, '2')).items).toEqual([]);
	});

	test('a cursor from another feed, a garbage cursor or a bad limit is an invalid request', async () => {
		const owner = await signUp();

		await seedAddon(owner.userId, 'cursors.addon');

		const addons = await tail(feeds.addons);
		const events = await tail(feeds.events);
		const invalid = { status: 400, code: 'invalid_request' } as const;

		expect(await failure(feeds.events(addons ?? undefined, '2'))).toEqual(invalid);
		expect(await failure(feeds.members(events ?? undefined, '2'))).toEqual(invalid);
		expect(await failure(feeds.addons('not-a-cursor', '2'))).toEqual(invalid);

		for (const limit of ['0', '501', 'ten', '2.5']) {
			expect(await failure(feeds.releases(undefined, limit))).toEqual(invalid);
		}

		expect((await feeds.releases(undefined, '500')).hasMore).toBe(false);
	});
});
