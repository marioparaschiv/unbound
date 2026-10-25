import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import {
	addon,
	addonMessage,
	auditEvent,
	feedCursor,
	loaderRelease,
	member,
	roleGrant,
	tag,
} from '~/db/schema';
import { feeds } from '~/lib/feed/feeds';

import {
	createTestDatabase,
	DROP_HOOK_TIMEOUT_MS,
	DATABASE_URL,
	recordNotifications,
	type NotificationLog,
	type TestDatabase,
} from './helpers/database';
import { ADDON, EVENT, MEMBER, RELEASE } from './helpers/feeds';

describe.skipIf(!DATABASE_URL)('notify triggers', () => {
	let database: TestDatabase;
	let log: NotificationLog;

	beforeAll(async () => {
		database = await createTestDatabase();
		log = await recordNotifications(database);
	});

	afterAll(async () => {
		await log.stop();
		await database.drop();
	}, DROP_HOOK_TIMEOUT_MS);

	beforeEach(async () => {
		await log.flush();
		log.received.length = 0;
	});

	async function received() {
		await log.flush();

		return [...log.received];
	}

	test('every channel fires on insert with the row key as payload', async () => {
		const { db } = database;

		await db.transaction((tx) => feeds.addons.ingest(tx, [ADDON]));
		await db.transaction((tx) => feeds.events.ingest(tx, [EVENT]));
		await db.transaction((tx) => feeds.releases.ingest(tx, [RELEASE]));
		await db.transaction((tx) => feeds.members.ingest(tx, [MEMBER]));

		expect(await received()).toEqual([
			{ channel: 'addon_changed', payload: 'addon-1' },
			{ channel: 'audit_event', payload: '1' },
			{ channel: 'loader_release', payload: 'ios:1.2.3' },
			{ channel: 'member_changed', payload: 'user-1' },
		]);
	});

	test('addon and member fire on a meaningful update', async () => {
		const { db } = database;

		await db.transaction((tx) => feeds.addons.ingest(tx, [{ ...ADDON, listed: false }]));
		await db.transaction((tx) =>
			feeds.addons.ingest(tx, [{ ...ADDON, listed: false, version: '1.1.0' }]),
		);
		await db.transaction((tx) => feeds.members.ingest(tx, [{ ...MEMBER, isSponsor: true }]));

		expect(await received()).toEqual([
			{ channel: 'addon_changed', payload: 'addon-1' },
			{ channel: 'addon_changed', payload: 'addon-1' },
			{ channel: 'member_changed', payload: 'user-1' },
		]);
	});

	test('an identical addon or member re-upsert sends nothing', async () => {
		const { db } = database;
		const addonItem = { ...ADDON, id: 'addon-2' };
		const memberItem = { ...MEMBER, userId: 'user-2' };

		await db.transaction((tx) => feeds.addons.ingest(tx, [addonItem]));
		await db.transaction((tx) => feeds.members.ingest(tx, [memberItem]));
		expect(await received()).toHaveLength(2);
		log.received.length = 0;

		await db.transaction((tx) => feeds.addons.ingest(tx, [addonItem]));
		await db.transaction((tx) =>
			feeds.addons.ingest(tx, [{ ...addonItem, updatedAt: '2026-10-02T00:00:00.000Z' }]),
		);
		await db.transaction((tx) => feeds.members.ingest(tx, [memberItem]));
		expect(await received()).toEqual([]);
	});

	test('tag, feed_cursor, addon_message and role_grant send nothing', async () => {
		const { db } = database;

		await db.insert(tag).values({ name: 'faq', content: 'Read the docs.' });
		await db.update(tag).set({ content: 'Read the FAQ.' }).where(eq(tag.name, 'faq'));
		await db.insert(feedCursor).values({ feed: 'addons', cursor: 'c1' });
		await db.update(feedCursor).set({ cursor: 'c2' }).where(eq(feedCursor.feed, 'addons'));
		await db
			.insert(addonMessage)
			.values({ addonId: 'addon-1', channelId: '2', messageId: '3', postedHash: 'h' });
		await db
			.update(addonMessage)
			.set({ postedHash: 'h2' })
			.where(eq(addonMessage.addonId, 'addon-1'));
		await db.insert(roleGrant).values({ discordId: '1', role: 'sponsor' });

		expect(await received()).toEqual([]);
	});

	test('a direct update of untracked addon, event and release columns sends nothing', async () => {
		const { db } = database;

		await db.update(addon).set({ updatedAt: new Date() }).where(eq(addon.id, 'addon-1'));
		await db
			.update(auditEvent)
			.set({ channelId: '2', messageId: '3' })
			.where(eq(auditEvent.id, 1));
		await db
			.update(loaderRelease)
			.set({ messageId: '3' })
			.where(eq(loaderRelease.version, '1.2.3'));
		await db.update(member).set({ updatedAt: new Date() }).where(eq(member.userId, 'user-1'));

		expect(await received()).toEqual([]);
	});
});
