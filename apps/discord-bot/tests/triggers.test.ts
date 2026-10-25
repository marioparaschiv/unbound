import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';

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

type MemberColumns = Partial<typeof member.$inferInsert>;

const MEMBER_CHANGES: [string, MemberColumns][] = [
	['discord_id', { discordId: '99' }],
	['github_id', { githubId: '99' }],
	['github_login', { githubLogin: 'someone-else' }],
	['is_addon_developer', { isAddonDeveloper: false }],
	['is_sponsor', { isSponsor: true }],
];

function uniqueId(prefix: string) {
	return `${prefix}-${randomBytes(4).toString('hex')}`;
}

describe.skipIf(!DATABASE_URL)('notify triggers', () => {
	let database: TestDatabase;
	let log: NotificationLog;
	let nextEventId = 1000;

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

		const notifications = [...log.received];

		log.received.length = 0;

		return notifications;
	}

	async function seedAddon() {
		const id = uniqueId('addon');

		await database.db.transaction((tx) => feeds.addons.ingest(tx, [{ ...ADDON, id }]));

		return id;
	}

	async function seedMember() {
		const userId = uniqueId('user');

		await database.db.transaction((tx) => feeds.members.ingest(tx, [{ ...MEMBER, userId }]));

		return userId;
	}

	async function seedRelease() {
		const version = uniqueId('1.0');

		await database.db.transaction((tx) => feeds.releases.ingest(tx, [{ ...RELEASE, version }]));

		return version;
	}

	async function seedEvent() {
		const id = nextEventId++;

		await database.db.transaction((tx) => feeds.events.ingest(tx, [{ ...EVENT, id }]));

		return id;
	}

	test('every channel fires on insert with the row key as payload', async () => {
		const addonId = await seedAddon();
		const eventId = await seedEvent();
		const version = await seedRelease();
		const userId = await seedMember();

		expect(await received()).toEqual([
			{ channel: 'addon_changed', payload: addonId },
			{ channel: 'audit_event', payload: String(eventId) },
			{ channel: 'loader_release', payload: `ios:${version}` },
			{ channel: 'member_changed', payload: userId },
		]);
	});

	test('addon and member fire on a meaningful ingest update', async () => {
		const { db } = database;
		const id = await seedAddon();
		const userId = await seedMember();

		await received();
		await db.transaction((tx) => feeds.addons.ingest(tx, [{ ...ADDON, id, listed: false }]));
		await db.transaction((tx) =>
			feeds.addons.ingest(tx, [{ ...ADDON, id, listed: false, version: '1.1.0' }]),
		);
		await db.transaction((tx) =>
			feeds.members.ingest(tx, [{ ...MEMBER, userId, isSponsor: true }]),
		);

		expect(await received()).toEqual([
			{ channel: 'addon_changed', payload: id },
			{ channel: 'addon_changed', payload: id },
			{ channel: 'member_changed', payload: userId },
		]);
	});

	test('a direct update of addon.listed alone or addon.content_hash alone fires', async () => {
		const { db } = database;
		const id = await seedAddon();

		await received();
		await db.update(addon).set({ listed: false }).where(eq(addon.id, id));
		expect(await received()).toEqual([{ channel: 'addon_changed', payload: id }]);

		await db.update(addon).set({ contentHash: 'changed' }).where(eq(addon.id, id));
		expect(await received()).toEqual([{ channel: 'addon_changed', payload: id }]);
	});

	for (const [column, change] of MEMBER_CHANGES) {
		test(`a direct update of member.${column} alone fires`, async () => {
			const userId = await seedMember();

			await received();
			await database.db.update(member).set(change).where(eq(member.userId, userId));

			expect(await received()).toEqual([{ channel: 'member_changed', payload: userId }]);
		});
	}

	test('an identical addon or member re-upsert sends nothing', async () => {
		const { db } = database;
		const id = await seedAddon();
		const userId = await seedMember();

		await received();
		await db.transaction((tx) => feeds.addons.ingest(tx, [{ ...ADDON, id }]));
		await db.transaction((tx) =>
			feeds.addons.ingest(tx, [{ ...ADDON, id, updatedAt: '2026-10-02T00:00:00.000Z' }]),
		);
		await db.transaction((tx) => feeds.members.ingest(tx, [{ ...MEMBER, userId }]));

		expect(await received()).toEqual([]);
	});

	test('tag, feed_cursor, addon_message and role_grant send nothing', async () => {
		const { db } = database;
		const id = await seedAddon();
		const name = uniqueId('faq');

		await received();
		await db.insert(tag).values({ name, content: 'Read the docs.' });
		await db.update(tag).set({ content: 'Read the FAQ.' }).where(eq(tag.name, name));
		await db
			.insert(feedCursor)
			.values({ feed: 'addons', cursor: 'c1' })
			.onConflictDoUpdate({ target: feedCursor.feed, set: { cursor: 'c1' } });
		await db.update(feedCursor).set({ cursor: 'c2' }).where(eq(feedCursor.feed, 'addons'));
		await db
			.insert(addonMessage)
			.values({ addonId: id, channelId: '2', messageId: '3', postedHash: 'h' });
		await db.update(addonMessage).set({ postedHash: 'h2' }).where(eq(addonMessage.addonId, id));
		await db.insert(roleGrant).values({ discordId: uniqueId('discord'), role: 'sponsor' });

		expect(await received()).toEqual([]);
	});

	test('a direct update of untracked addon, event, release and member columns sends nothing', async () => {
		const { db } = database;
		const id = await seedAddon();
		const eventId = await seedEvent();
		const version = await seedRelease();
		const userId = await seedMember();
		const ofRelease = and(
			eq(loaderRelease.platform, 'ios'),
			eq(loaderRelease.version, version),
		);

		await received();
		await db.update(addon).set({ updatedAt: new Date() }).where(eq(addon.id, id));
		await db
			.update(auditEvent)
			.set({ channelId: '2', messageId: '3' })
			.where(eq(auditEvent.id, eventId));
		await db.update(loaderRelease).set({ messageId: '3' }).where(ofRelease);
		await db
			.update(loaderRelease)
			.set({ url: 'https://example.com/other.ipa', changelog: 'More fixes.' })
			.where(ofRelease);
		await db.update(member).set({ updatedAt: new Date() }).where(eq(member.userId, userId));

		expect(await received()).toEqual([]);
	});
});
