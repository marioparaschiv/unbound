import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq, sql } from 'drizzle-orm';

import { reconcileAddons, syncAddon, type AddonChannels } from '~/dispatchers/addons';
import type { AddonFeedItem } from '~/lib/feed/types';
import { addon, addonMessage } from '~/db/schema';
import { createDatabase } from '~/db/database';
import { feeds } from '~/lib/feed/feeds';

import {
	createTestDatabase,
	DROP_HOOK_TIMEOUT_MS,
	DATABASE_URL,
	type TestDatabase,
} from './helpers/database';
import { createFakeDiscord, embedLength, type FakeDiscord } from './helpers/fake-discord';
import { ADDON } from './helpers/feeds';

const CHANNELS: AddonChannels = { plugin: '11', theme: '12', 'icon-pack': '13' };

const PLUGIN: AddonFeedItem = {
	...ADDON,
	id: 'plugin-1',
	authors: [
		{ name: 'Mario', discordId: '1' },
		{ name: 'Alex', discordId: '2' },
	],
	iconUrl: 'https://unbound.rip/icons/plugin-1.png',
	pageUrl: 'https://unbound.rip/addons/plugin-1',
};
const THEME: AddonFeedItem = {
	...PLUGIN,
	id: 'theme-1',
	type: 'theme',
	name: 'Midnight',
	iconUrl: undefined,
	pageUrl: 'https://unbound.rip/addons/theme-1',
};
const ICON_PACK: AddonFeedItem = {
	...PLUGIN,
	id: 'icons-1',
	type: 'icon-pack',
	name: 'Rounded',
	pageUrl: 'https://unbound.rip/addons/icons-1',
};
const FONT: AddonFeedItem = {
	...PLUGIN,
	id: 'font-1',
	type: 'font',
	name: 'Inter',
	pageUrl: 'https://unbound.rip/addons/font-1',
};

describe.skipIf(!DATABASE_URL)('addon announcements', () => {
	let database: TestDatabase;
	let discord: FakeDiscord;

	beforeAll(async () => {
		database = await createTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	}, DROP_HOOK_TIMEOUT_MS);

	beforeEach(async () => {
		await database.db.execute(sql`TRUNCATE addon, addon_message`);
		discord = createFakeDiscord();
	});

	afterEach(async () => {
		await discord.stop();
	});

	async function ingest(...items: AddonFeedItem[]) {
		await database.db.transaction((tx) => feeds.addons.ingest(tx, items));
	}

	function sync(id: string) {
		return syncAddon(database.db, discord.rest, id, CHANNELS);
	}

	function reconcile() {
		return reconcileAddons(database.db, discord.rest, discord.selfId, CHANNELS);
	}

	async function rowOf(id: string) {
		const [row] = await database.db
			.select()
			.from(addonMessage)
			.where(eq(addonMessage.addonId, id));

		return row;
	}

	function messagesOf(item: AddonFeedItem) {
		const channelId = CHANNELS[item.type];

		return channelId
			? discord
					.messages(channelId)
					.filter((message) => message.embeds[0]?.url === item.pageUrl)
			: [];
	}

	function writes() {
		return discord.requests.filter((request) => request.method !== 'GET');
	}

	test('a listed plugin, theme and icon pack each get one embed in their own channel; a font gets none', async () => {
		await ingest(PLUGIN, THEME, ICON_PACK, FONT);

		for (const item of [PLUGIN, THEME, ICON_PACK, FONT]) {
			await sync(item.id);
		}

		expect(discord.messages('11')).toHaveLength(1);
		expect(discord.messages('12')).toHaveLength(1);
		expect(discord.messages('13')).toHaveLength(1);
		expect(writes().map((request) => request.channelId)).toEqual(['11', '12', '13']);
		expect(await rowOf(FONT.id)).toBeUndefined();

		const [plugin] = discord.messages('11');
		const [theme] = discord.messages('12');

		expect(plugin?.author.id).toBe(discord.selfId);
		expect(plugin?.allowed_mentions).toEqual({ parse: [] });
		expect(plugin?.embeds).toEqual([
			{
				title: 'Silent Typing',
				url: PLUGIN.pageUrl,
				description: 'Hides your typing indicator.',
				color: 0xc8_41_51,
				fields: [
					{ name: 'Version', value: '1.0.0', inline: true },
					{ name: 'Authors', value: 'Mario, Alex', inline: true },
				],
				thumbnail: { url: PLUGIN.iconUrl ?? '' },
			},
		]);
		expect(theme?.embeds[0]?.thumbnail).toBeUndefined();

		for (const [item, channelId] of [
			[PLUGIN, '11'],
			[THEME, '12'],
			[ICON_PACK, '13'],
		] as const) {
			const [message] = discord.messages(channelId);

			expect(await rowOf(item.id)).toMatchObject({ channelId, messageId: message?.id });
		}
	});

	test('an addon with every text at its longest still posts within the embed size cap', async () => {
		const long = {
			...PLUGIN,
			name: 'n'.repeat(300),
			description: 'd'.repeat(10_000),
			version: 'v'.repeat(2000),
			authors: [{ name: 'a'.repeat(2000), discordId: '1' }],
		};

		await ingest(long);
		await sync(long.id);

		const [embed] = messagesOf(long)[0]?.embeds ?? [];

		expect(embed).toBeDefined();
		expect(embedLength(embed ?? {})).toBeLessThanOrEqual(6000);
	});

	test('a content change edits the message in place and advances posted_hash', async () => {
		await ingest(PLUGIN);
		await sync(PLUGIN.id);

		const before = await rowOf(PLUGIN.id);

		await ingest({ ...PLUGIN, version: '1.1.0', updatedAt: '2026-10-02T00:00:00.000Z' });
		await sync(PLUGIN.id);

		const after = await rowOf(PLUGIN.id);
		const [current] = await database.db.select().from(addon).where(eq(addon.id, PLUGIN.id));

		expect(writes().map((request) => request.method)).toEqual(['POST', 'PATCH']);
		expect(messagesOf(PLUGIN)).toHaveLength(1);
		expect(messagesOf(PLUGIN)[0]?.embeds[0]?.fields?.[0]?.value).toBe('1.1.0');
		expect(after?.messageId).toBe(before?.messageId);
		expect(after?.postedHash).toBe(current?.contentHash);
		expect(after?.postedHash).not.toBe(before?.postedHash);
		expect(after?.editedAt).toBeInstanceOf(Date);
	});

	// Two posts in one channel straddle the fake's id length change, so a string compare of snowflakes
	// would take the first as newest and delete the second as an orphan.
	test('re-syncing an identical snapshot writes nothing to Discord or the row', async () => {
		const other = { ...PLUGIN, id: 'plugin-2', pageUrl: 'https://unbound.rip/addons/plugin-2' };

		await ingest(PLUGIN, other);
		await sync(PLUGIN.id);
		await sync(other.id);

		const before = await rowOf(PLUGIN.id);
		const posted = writes().length;

		await ingest({ ...PLUGIN, updatedAt: '2026-10-03T00:00:00.000Z' });
		await sync(PLUGIN.id);
		await reconcile();

		expect(writes()).toHaveLength(posted);
		expect(await rowOf(PLUGIN.id)).toEqual(before);
	});

	test('delisting deletes the message and row; relisting posts exactly one new message', async () => {
		const counts: number[] = [];

		await ingest(PLUGIN);
		await sync(PLUGIN.id);
		counts.push(messagesOf(PLUGIN).length);

		await ingest({ ...PLUGIN, listed: false });
		await sync(PLUGIN.id);
		counts.push(messagesOf(PLUGIN).length);
		expect(await rowOf(PLUGIN.id)).toBeUndefined();

		await ingest(PLUGIN);
		await sync(PLUGIN.id);
		counts.push(messagesOf(PLUGIN).length);
		await reconcile();
		counts.push(messagesOf(PLUGIN).length);

		expect(counts).toEqual([1, 0, 1, 1]);
		expect(writes().map((request) => request.method)).toEqual(['POST', 'DELETE', 'POST']);
		expect(await rowOf(PLUGIN.id)).toMatchObject({ messageId: messagesOf(PLUGIN)[0]?.id });
	});

	test('a type change moves the message to the new channel', async () => {
		await ingest(PLUGIN);
		await sync(PLUGIN.id);
		await ingest({ ...PLUGIN, type: 'theme' });
		await sync(PLUGIN.id);

		expect(discord.messages('11')).toHaveLength(0);
		expect(discord.messages('12')).toHaveLength(1);
		expect(await rowOf(PLUGIN.id)).toMatchObject({
			channelId: '12',
			messageId: discord.messages('12')[0]?.id,
		});
	});

	test('a hand-deleted message is reposted on reconcile and the row follows it', async () => {
		await ingest(PLUGIN);
		await sync(PLUGIN.id);

		const before = await rowOf(PLUGIN.id);

		discord.handDelete('11', before?.messageId ?? '');
		await reconcile();

		const [message, ...extra] = messagesOf(PLUGIN);

		expect(extra).toHaveLength(0);
		expect(message?.id).not.toBe(before?.messageId);
		expect(await rowOf(PLUGIN.id)).toMatchObject({ messageId: message?.id });
	});

	test('an addon Discord rejects is logged and skipped, and the next reconcile posts it', async () => {
		await ingest(PLUGIN, THEME);
		discord.rejectPost = (body) => body.embeds?.[0]?.title === PLUGIN.name;
		await reconcile();

		expect(messagesOf(THEME)).toHaveLength(1);
		expect(await rowOf(PLUGIN.id)).toBeUndefined();

		discord.rejectPost = undefined;
		await reconcile();

		expect(messagesOf(PLUGIN)).toHaveLength(1);
		expect(messagesOf(THEME)).toHaveLength(1);
	});

	test('reconcile of synced addons lists each channel instead of fetching each message', async () => {
		await ingest(PLUGIN, THEME, ICON_PACK);
		await reconcile();
		discord.requests.length = 0;

		await reconcile();

		expect(discord.requests).toHaveLength(3);
		expect(discord.requests.every((request) => request.method === 'GET')).toBe(true);
		expect(discord.requests.every((request) => !request.messageId)).toBe(true);
	});

	test('reconcile deletes our duplicate and stale addon posts and keeps every other message', async () => {
		const delisted = { ...THEME, type: 'plugin' as const, listed: false };

		await ingest(PLUGIN, delisted);
		await sync(PLUGIN.id);

		const duplicate = discord.seed('11', discord.selfId, { embeds: [{ url: PLUGIN.pageUrl }] });
		const stale = discord.seed('11', discord.selfId, { embeds: [{ url: delisted.pageUrl }] });
		const unknown = discord.seed('11', discord.selfId, { embeds: [{ url: 'https://gone' }] });
		const human = discord.seed('11', '42', { embeds: [{ url: PLUGIN.pageUrl }] });

		await reconcile();

		const ids = discord.messages('11').map((message) => message.id);
		const ours = messagesOf(PLUGIN).filter((message) => message.id !== human);

		expect(ids).toContain(unknown);
		expect(ids).toContain(human);
		expect(ids).not.toContain(duplicate);
		expect(ids).not.toContain(stale);
		expect(ours).toHaveLength(1);
		expect(await rowOf(PLUGIN.id)).toMatchObject({ messageId: ours[0]?.id });
	});

	test('a row whose message is gone adopts our unreferenced post instead of reposting', async () => {
		await ingest(PLUGIN);
		await sync(PLUGIN.id);

		const before = await rowOf(PLUGIN.id);
		const spare = discord.seed('11', discord.selfId, { embeds: [{ url: PLUGIN.pageUrl }] });

		discord.handDelete('11', before?.messageId ?? '');
		discord.requests.length = 0;
		await reconcile();

		expect(discord.requests.map((request) => request.method)).not.toContain('POST');
		expect(messagesOf(PLUGIN).map((message) => message.id)).toEqual([spare]);
		expect(await rowOf(PLUGIN.id)).toMatchObject({
			messageId: spare,
			postedHash: before?.postedHash,
		});
	});

	test('reconcile pages past the first 100 messages to find our post', async () => {
		for (let i = 0; i < 150; i++) {
			discord.seed('11', discord.selfId, { embeds: [{ url: `https://old-bot/${i}` }] });
		}

		await ingest(PLUGIN);
		await sync(PLUGIN.id);

		const before = await rowOf(PLUGIN.id);
		const posted = writes().length;

		await reconcile();

		expect(writes()).toHaveLength(posted);
		expect(messagesOf(PLUGIN).map((message) => message.id)).toEqual([before?.messageId ?? '']);
		expect(discord.messages('11')).toHaveLength(151);
	});

	test('reconcile keeps an old bot message whose url names no addon', async () => {
		const old = discord.seed('11', discord.selfId, { embeds: [{ url: 'https://old-bot' }] });

		await ingest(PLUGIN);
		await reconcile();

		expect(discord.messages('11').map((message) => message.id)).toContain(old);
		expect(messagesOf(PLUGIN)).toHaveLength(1);
	});

	test('a post retried after a timeout leaves one message and one row', async () => {
		await discord.stop();
		discord = createFakeDiscord({ retries: 1, timeout: 100 });
		discord.beforePostResponse = async () => {
			discord.beforePostResponse = undefined;
			await Bun.sleep(300);
		};

		await ingest(PLUGIN);
		await sync(PLUGIN.id);

		const [message, ...extra] = messagesOf(PLUGIN);

		expect(writes().map((request) => request.method)).toEqual(['POST', 'POST']);
		expect(extra).toHaveLength(0);
		expect(await rowOf(PLUGIN.id)).toMatchObject({ messageId: message?.id });
	});

	// The fake Discord's POST handler ends the sync's own database client before it responds, so
	// the real post lands and the row write after it fails.
	async function crashSync(id: string) {
		const crashing = createDatabase(database.url);

		discord.beforePostResponse = () => crashing.$client.end();

		const outcome = await syncAddon(crashing, discord.rest, id, CHANNELS).then(
			() => 'synced',
			() => 'failed',
		);

		discord.beforePostResponse = undefined;

		return outcome;
	}

	test('a failed row write deletes the message it just posted, and reconcile reposts it', async () => {
		await ingest(PLUGIN);

		expect(await crashSync(PLUGIN.id)).toBe('failed');
		expect(writes().map((request) => request.method)).toEqual(['POST', 'DELETE']);
		expect(messagesOf(PLUGIN)).toHaveLength(0);
		expect(await rowOf(PLUGIN.id)).toBeUndefined();

		await reconcile();

		const [message, ...extra] = messagesOf(PLUGIN);

		expect(extra).toHaveLength(0);
		expect(await rowOf(PLUGIN.id)).toMatchObject({ channelId: '11', messageId: message?.id });
	});

	// Discord refusing the cleanup delete leaves a post with no row, the case adoption exists for.
	test('a post left without its row is adopted and shows current content', async () => {
		await ingest(PLUGIN);
		discord.rejectDelete = () => true;

		expect(await crashSync(PLUGIN.id)).toBe('failed');

		const [orphan] = messagesOf(PLUGIN);

		discord.rejectDelete = undefined;
		await ingest({ ...PLUGIN, version: '2.0.0', updatedAt: '2026-10-04T00:00:00.000Z' });
		await reconcile();

		const [message, ...extra] = messagesOf(PLUGIN);

		expect(extra).toHaveLength(0);
		expect(message?.id).toBe(orphan?.id);
		expect(message?.embeds[0]?.fields?.[0]?.value).toBe('2.0.0');
		expect(await rowOf(PLUGIN.id)).toMatchObject({ channelId: '11', messageId: message?.id });
	});

	test('a post left without its row is adopted when a later post in its channel has a row', async () => {
		const other = { ...PLUGIN, id: 'plugin-2', pageUrl: 'https://unbound.rip/addons/plugin-2' };

		await ingest(PLUGIN, other);
		discord.rejectDelete = () => true;

		expect(await crashSync(PLUGIN.id)).toBe('failed');

		discord.rejectDelete = undefined;
		await sync(other.id);
		await reconcile();

		const [message, ...extra] = messagesOf(PLUGIN);

		expect(extra).toHaveLength(0);
		expect(messagesOf(other)).toHaveLength(1);
		expect(await rowOf(PLUGIN.id)).toMatchObject({ messageId: message?.id });
	});

	test('a type change whose repost lost its row converges to one message in the new channel', async () => {
		await ingest(PLUGIN);
		await sync(PLUGIN.id);

		const old = (await rowOf(PLUGIN.id))?.messageId;

		await ingest({ ...PLUGIN, type: 'theme' });
		discord.rejectDelete = (messageId) => messageId !== old;

		expect(await crashSync(PLUGIN.id)).toBe('failed');

		discord.rejectDelete = undefined;
		await reconcile();

		const [message, ...extra] = discord.messages('12');

		expect(discord.messages('11')).toHaveLength(0);
		expect(extra).toHaveLength(0);
		expect(await rowOf(PLUGIN.id)).toMatchObject({ channelId: '12', messageId: message?.id });
	});
});
