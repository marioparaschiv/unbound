import { manifest, schema, seedApprovedAddon, signInWithDiscord } from '@unbound-app/web/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { PublicAddon } from '@unbound-app/web/bot';
import type { APIMessage } from 'discord.js';
import { eq, sql } from 'drizzle-orm';
import sharp from 'sharp';

import { reconcileAddons, syncAddon, type AddonChannels } from '~/dispatchers/addons';
import { createDatabase, type Database } from '~/db/database';
import { messageLinks } from '~/dispatchers/addon-card';
import type { AuthorEmojis } from '~/lib/author-emojis';
import { contentHash } from '~/lib/content-hash';
import type { AppEmoji } from '~/lib/constants';
import { addonMessage } from '~/db/schema';

import {
	componentsTextLength,
	createFakeDiscord,
	type FakeDiscord,
	type FakeMessage,
} from './helpers/fake-discord-rest';
import { createBotTestDatabase, DATABASE_URL, type BotTestDatabase } from './helpers/database';
import { ADDON, createFakeReads, type FakeReads } from './helpers/fake-reads';

const CHANNELS: AddonChannels = { plugin: '11', theme: '12', 'icon-pack': '13' };

const PLUGIN: PublicAddon = {
	...ADDON,
	id: 'plugin-1',
	authors: [
		{ name: 'Mario', discordId: '1' },
		{ name: 'Alex', discordId: '2' },
	],
	pageUrl: 'https://unbound.rip/addons/plugin-1',
	installUrl: 'https://unbound.rip/install/plugin-1',
};
const THEME: PublicAddon = {
	...PLUGIN,
	id: 'theme-1',
	type: 'theme',
	name: 'Midnight',
	pageUrl: 'https://unbound.rip/addons/theme-1',
	sourceUrl: undefined,
};
const ICON_PACK: PublicAddon = {
	...PLUGIN,
	id: 'icons-1',
	type: 'icon-pack',
	name: 'Rounded',
	pageUrl: 'https://unbound.rip/addons/icons-1',
};
const FONT: PublicAddon = {
	...PLUGIN,
	id: 'font-1',
	type: 'font',
	name: 'Inter',
	pageUrl: 'https://unbound.rip/addons/font-1',
};

type CardNode = {
	type: number;
	content?: string;
	url?: string;
	label?: string;
	components?: CardNode[];
	accessory?: CardNode;
	items?: { media: { url: string } }[];
};

function nodes(message: Pick<APIMessage, 'components'> | undefined): CardNode[] {
	const walk = (list: readonly CardNode[]): CardNode[] =>
		list.flatMap((node) => [
			node,
			...walk(node.components ?? []),
			...walk(node.accessory ? [node.accessory] : []),
		]);

	return walk(message?.components ?? []);
}

function cardText(message: FakeMessage | undefined) {
	return nodes(message)
		.flatMap((node) => (node.content === undefined ? [] : [node.content]))
		.join('\n');
}

function buttons(message: FakeMessage | undefined) {
	return nodes(message).flatMap((node) =>
		node.url && node.label ? [{ label: node.label, url: node.url }] : [],
	);
}

describe.skipIf(!DATABASE_URL)('addon announcements', () => {
	let database: BotTestDatabase;
	let discord: FakeDiscord;
	let fake: FakeReads;

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	});

	beforeEach(async () => {
		await database.db.execute(sql`TRUNCATE bot.addon_message`);
		discord = createFakeDiscord();
		fake = createFakeReads();
	});

	afterEach(async () => {
		await discord.stop();
	});

	function stores(db: Database = database.db) {
		return { db, web: fake.reads };
	}

	function ingest(...items: PublicAddon[]) {
		for (const item of items) {
			fake.addons.set(item.id, item);
		}
	}

	function sync(id: string) {
		return syncAddon(stores(), discord.rest, id, CHANNELS);
	}

	function reconcile() {
		return reconcileAddons(stores(), discord.rest, discord.selfId, CHANNELS);
	}

	async function rowOf(id: string) {
		const [row] = await database.db
			.select()
			.from(addonMessage)
			.where(eq(addonMessage.addonId, id));

		return row;
	}

	function messagesOf(item: PublicAddon) {
		const channelId = CHANNELS[item.type];

		return channelId
			? discord
					.messages(channelId)
					.filter((message) => messageLinks(message).includes(item.pageUrl))
			: [];
	}

	function writes() {
		return discord.requests.filter((request) => request.method !== 'GET');
	}

	test('a listed plugin, theme and icon pack each get one card in their own channel; a font gets none', async () => {
		ingest(PLUGIN, THEME, ICON_PACK, FONT);

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
		expect(plugin?.flags).toBe(1 << 15);
		expect(plugin?.files).toEqual(['icon.png']);
		expect(cardText(plugin)).toContain('## Silent Typing\nHides your typing indicator.');
		expect(cardText(plugin)).toContain(' Plugin\n');
		expect(cardText(plugin)).toContain('`v1.0.0`');
		expect(cardText(plugin)).toContain('Mario, Alex');
		expect(buttons(plugin)).toEqual([
			{ label: 'Install', url: PLUGIN.installUrl },
			{ label: 'Web', url: PLUGIN.pageUrl },
			{ label: 'Changelog', url: `${PLUGIN.pageUrl}#changelog` },
			{ label: 'Source', url: PLUGIN.sourceUrl ?? '' },
		]);
		expect(buttons(theme).map((button) => button.label)).toEqual([
			'Install',
			'Web',
			'Changelog',
		]);
		expect(cardText(theme)).toContain(' Theme\n');

		for (const [item, channelId] of [
			[PLUGIN, '11'],
			[THEME, '12'],
			[ICON_PACK, '13'],
		] as const) {
			const [message] = discord.messages(channelId);

			expect(await rowOf(item.id)).toMatchObject({ channelId, messageId: message?.id });
		}
	});

	test('an addon with every text at its longest still posts within the text cap', async () => {
		const long = {
			...PLUGIN,
			name: 'n'.repeat(300),
			description: 'd'.repeat(10_000),
			version: 'v'.repeat(2000),
			authors: [{ name: 'a'.repeat(2000), discordId: '1' }],
		};

		ingest(long);
		await sync(long.id);

		const [message] = messagesOf(long);

		expect(message).toBeDefined();
		expect(componentsTextLength(message?.components ?? [])).toBeLessThanOrEqual(4000);
	});

	test('a content change edits the message in place and advances posted_hash', async () => {
		ingest(PLUGIN);
		await sync(PLUGIN.id);

		const before = await rowOf(PLUGIN.id);

		ingest({ ...PLUGIN, version: '1.1.0' });
		await sync(PLUGIN.id);

		const after = await rowOf(PLUGIN.id);
		const current = fake.addons.get(PLUGIN.id);

		expect(writes().map((request) => request.method)).toEqual(['POST', 'PATCH']);
		expect(messagesOf(PLUGIN)).toHaveLength(1);
		expect(cardText(messagesOf(PLUGIN)[0])).toContain('`v1.1.0`');
		expect(after?.messageId).toBe(before?.messageId);
		expect(after?.postedHash).toBe(current ? contentHash(current) : '');
		expect(after?.postedHash).not.toBe(before?.postedHash);
		expect(after?.editedAt).toBeInstanceOf(Date);
	});

	// Two posts in one channel straddle the fake's id length change, so a string compare of snowflakes
	// would take the first as newest and delete the second as an orphan.
	test('re-syncing an identical snapshot writes nothing to Discord or the row', async () => {
		const other = { ...PLUGIN, id: 'plugin-2', pageUrl: 'https://unbound.rip/addons/plugin-2' };

		ingest(PLUGIN, other);
		await sync(PLUGIN.id);
		await sync(other.id);

		const before = await rowOf(PLUGIN.id);
		const posted = writes().length;

		ingest({ ...PLUGIN });
		await sync(PLUGIN.id);
		await reconcile();

		expect(writes()).toHaveLength(posted);
		expect(await rowOf(PLUGIN.id)).toEqual(before);
	});

	test('delisting deletes the message and row; relisting posts exactly one new message', async () => {
		const counts: number[] = [];

		ingest(PLUGIN);
		await sync(PLUGIN.id);
		counts.push(messagesOf(PLUGIN).length);

		ingest({ ...PLUGIN, listed: false });
		await sync(PLUGIN.id);
		counts.push(messagesOf(PLUGIN).length);
		expect(await rowOf(PLUGIN.id)).toBeUndefined();

		ingest(PLUGIN);
		await sync(PLUGIN.id);
		counts.push(messagesOf(PLUGIN).length);
		await reconcile();
		counts.push(messagesOf(PLUGIN).length);

		expect(counts).toEqual([1, 0, 1, 1]);
		expect(writes().map((request) => request.method)).toEqual(['POST', 'DELETE', 'POST']);
		expect(await rowOf(PLUGIN.id)).toMatchObject({ messageId: messagesOf(PLUGIN)[0]?.id });
	});

	test('a type change moves the message to the new channel', async () => {
		ingest(PLUGIN);
		await sync(PLUGIN.id);
		ingest({ ...PLUGIN, type: 'theme' });
		await sync(PLUGIN.id);

		expect(discord.messages('11')).toHaveLength(0);
		expect(discord.messages('12')).toHaveLength(1);
		expect(await rowOf(PLUGIN.id)).toMatchObject({
			channelId: '12',
			messageId: discord.messages('12')[0]?.id,
		});
	});

	test('a hand-deleted message is reposted on reconcile and the row follows it', async () => {
		ingest(PLUGIN);
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
		ingest(PLUGIN, THEME);
		discord.rejectPost = (body) =>
			JSON.stringify(body.components).includes(`## ${PLUGIN.name}`);
		await reconcile();

		expect(messagesOf(THEME)).toHaveLength(1);
		expect(await rowOf(PLUGIN.id)).toBeUndefined();

		discord.rejectPost = undefined;
		await reconcile();

		expect(messagesOf(PLUGIN)).toHaveLength(1);
		expect(messagesOf(THEME)).toHaveLength(1);
	});

	test('reconcile of synced addons lists each channel instead of fetching each message', async () => {
		ingest(PLUGIN, THEME, ICON_PACK);
		await reconcile();
		discord.requests.length = 0;

		await reconcile();

		expect(discord.requests).toHaveLength(3);
		expect(discord.requests.every((request) => request.method === 'GET')).toBe(true);
		expect(discord.requests.every((request) => !request.messageId)).toBe(true);
	});

	test('reconcile deletes our duplicate and stale addon posts and keeps every other message', async () => {
		const delisted = { ...THEME, type: 'plugin' as const, listed: false };

		ingest(PLUGIN, delisted);
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
		ingest(PLUGIN);
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

		ingest(PLUGIN);
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

		ingest(PLUGIN);
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

		ingest(PLUGIN);
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

		const outcome = await syncAddon(stores(crashing), discord.rest, id, CHANNELS).then(
			() => 'synced',
			() => 'failed',
		);

		discord.beforePostResponse = undefined;

		return outcome;
	}

	test('a failed row write deletes the message it just posted, and reconcile reposts it', async () => {
		ingest(PLUGIN);

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
		ingest(PLUGIN);
		discord.rejectDelete = () => true;

		expect(await crashSync(PLUGIN.id)).toBe('failed');

		const [orphan] = messagesOf(PLUGIN);

		discord.rejectDelete = undefined;
		ingest({ ...PLUGIN, version: '2.0.0' });
		await reconcile();

		const [message, ...extra] = messagesOf(PLUGIN);

		expect(extra).toHaveLength(0);
		expect(message?.id).toBe(orphan?.id);
		expect(cardText(message)).toContain('`v2.0.0`');
		expect(await rowOf(PLUGIN.id)).toMatchObject({ channelId: '11', messageId: message?.id });
	});

	test('a post left without its row is adopted when a later post in its channel has a row', async () => {
		const other = { ...PLUGIN, id: 'plugin-2', pageUrl: 'https://unbound.rip/addons/plugin-2' };

		ingest(PLUGIN, other);
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
		ingest(PLUGIN);
		await sync(PLUGIN.id);

		const old = (await rowOf(PLUGIN.id))?.messageId;

		ingest({ ...PLUGIN, type: 'theme' });
		discord.rejectDelete = (messageId) => messageId !== old;

		expect(await crashSync(PLUGIN.id)).toBe('failed');

		discord.rejectDelete = undefined;
		await reconcile();

		const [message, ...extra] = discord.messages('12');

		expect(discord.messages('11')).toHaveLength(0);
		expect(extra).toHaveLength(0);
		expect(await rowOf(PLUGIN.id)).toMatchObject({ channelId: '12', messageId: message?.id });
	});

	test('an addon approved on the web posts its listing, and a delist on the web removes it', async () => {
		const { web, reads } = database;
		const owner = await signInWithDiscord(web, {
			id: '700',
			name: 'Owner',
			email: 'addons-owner@example.com',
		});
		const real = { db: database.db, web: reads };

		await seedApprovedAddon(web, owner.userId, manifest('web.listed', '2.0.0'));
		await syncAddon(real, discord.rest, 'web.listed', CHANNELS);

		const [message, ...extra] = discord.messages('11');

		expect(extra).toHaveLength(0);
		expect(cardText(message)).toContain('## Hello');
		expect(cardText(message)).toContain('`v2.0.0`');
		expect(buttons(message).slice(0, 2)).toEqual([
			{ label: 'Install', url: 'https://unbound.rip/install/web.listed' },
			{ label: 'Web', url: 'https://unbound.rip/addons/web.listed' },
		]);
		expect(await rowOf('web.listed')).toMatchObject({
			messageId: message?.id,
			postedHash: contentHash((await reads.addon('web.listed')) ?? ADDON),
		});

		await web.db
			.update(schema.addon)
			.set({ delistedAt: new Date() })
			.where(eq(schema.addon.id, 'web.listed'));
		await reconcileAddons(real, discord.rest, discord.selfId, CHANNELS);

		expect(discord.messages('11')).toHaveLength(0);
		expect(await rowOf('web.listed')).toBeUndefined();
	});

	test('a gallery is stitched into one image under the card; an image that fails to load is left out', async () => {
		const shot = await sharp({
			create: { width: 90, height: 160, channels: 3, background: '#336699' },
		})
			.png()
			.toBuffer();
		const server = Bun.serve({
			port: 0,
			hostname: '127.0.0.1',
			fetch: (request) =>
				new URL(request.url).pathname === '/shot.png'
					? new Response(shot, { headers: { 'content-type': 'image/png' } })
					: new Response(null, { status: 404 }),
		});
		const base = `http://127.0.0.1:${server.port}`;

		try {
			ingest({
				...PLUGIN,
				gallery: [
					{ url: `${base}/shot.png`, width: 90, height: 160, alt: 'Chat' },
					{ url: `${base}/gone.png`, width: 90, height: 160, alt: 'Gone' },
				],
			});
			await sync(PLUGIN.id);
		} finally {
			await server.stop(true);
		}

		const [message] = messagesOf(PLUGIN);
		const gallery = nodes(message).find((node) => node.items);

		expect(message?.files).toEqual(['icon.png', 'gallery.png']);
		expect(gallery?.items?.map((item) => item.media.url)).toEqual(['attachment://gallery.png']);
	});

	test('an author whose avatar emoji changes gets the card edited to show it', async () => {
		let avatar: AppEmoji = { name: 'av_1_aaaa', id: '501' };
		const emojis: AuthorEmojis = {
			resolve: async (ids) => new Map(ids.map((id) => [id, avatar])),
			prune: async () => {},
		};

		ingest(PLUGIN);
		await syncAddon(stores(), discord.rest, PLUGIN.id, CHANNELS, undefined, emojis);
		await syncAddon(stores(), discord.rest, PLUGIN.id, CHANNELS, undefined, emojis);

		expect(cardText(messagesOf(PLUGIN)[0])).toContain('<:av_1_aaaa:501> Mario');

		avatar = { name: 'av_1_bbbb', id: '502' };
		await syncAddon(stores(), discord.rest, PLUGIN.id, CHANNELS, undefined, emojis);

		expect(writes().map((request) => request.method)).toEqual(['POST', 'PATCH']);
		expect(cardText(messagesOf(PLUGIN)[0])).toContain('<:av_1_bbbb:502> Mario');
	});
});
