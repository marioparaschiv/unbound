import {
	linkGitHub,
	manifest,
	schema,
	seedApprovedAddon,
	seedSponsorship,
	seedVersion,
	signInWithDiscord,
	snowflakeAt,
} from '@unbound-app/web/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';

import { addonMessage, auditPost, releasePost, roleGrant, tag } from '~/db/schema';

import {
	createBotTestDatabase,
	DATABASE_URL,
	recordNotifications,
	type BotTestDatabase,
	type Notification,
	type NotificationLog,
} from './helpers/database';

const {
	account,
	addon,
	addonMaintainer,
	addonVersion,
	loaderRelease,
	moderationEvent,
	sponsorship,
	user,
} = schema;

function uniqueId(prefix: string) {
	return `${prefix}-${randomBytes(4).toString('hex')}`;
}

function sorted(notifications: Notification[]) {
	return notifications.toSorted((a, b) =>
		`${a.channel} ${a.payload}`.localeCompare(`${b.channel} ${b.payload}`),
	);
}

describe.skipIf(!DATABASE_URL)('triggers on the web tables', () => {
	let database: BotTestDatabase;
	let log: NotificationLog;
	let users = 0;

	beforeAll(async () => {
		database = await createBotTestDatabase();
		log = await recordNotifications(database);
	});

	afterAll(async () => {
		await log.stop();
		await database.drop();
	});

	beforeEach(async () => {
		await received();
	});

	async function received() {
		await log.flush();

		const notifications = [...log.received];

		log.received.length = 0;

		return notifications;
	}

	async function signUp() {
		users += 1;

		return signInWithDiscord(database.web, {
			id: snowflakeAt(new Date(Date.UTC(2021, 0, users))),
			name: `Member ${users}`,
			email: `triggers-${users}@example.com`,
		});
	}

	async function insertAddon(id: string = uniqueId('addon')) {
		await database.web.db.insert(addon).values({
			id,
			type: 'plugin',
			name: 'Hello',
			description: 'Says hello.',
			updatedAt: new Date(),
		});

		return id;
	}

	async function insertEvent() {
		const [row] = await database.web.db
			.insert(moderationEvent)
			.values({
				subjectType: 'addon',
				subjectId: 'any',
				kind: 'addon.delisted',
				data: {},
				createdAt: new Date(),
			})
			.returning({ id: moderationEvent.id });

		return row?.id ?? 0;
	}

	function insertRelease(version: string, url: string) {
		return database.web.db
			.insert(loaderRelease)
			.values({ platform: 'ios', version, versionKey: version, url, publishedAt: new Date() })
			.onConflictDoUpdate({
				target: [loaderRelease.platform, loaderRelease.version],
				set: { url },
			});
	}

	test('a Discord sign-in and a GitHub link each wake the member by user id', async () => {
		const { userId } = await signUp();

		expect(await received()).toEqual([
			{ channel: 'member_changed', payload: `user:${userId}` },
		]);

		await linkGitHub(database.web, userId, 'token');

		expect(await received()).toEqual([
			{ channel: 'member_changed', payload: `user:${userId}` },
		]);
	});

	test('a token refresh and a link of another provider send nothing', async () => {
		const { userId } = await signUp();

		await received();
		await database.web.db
			.update(account)
			.set({ accessToken: 'refreshed', refreshToken: 'again', updatedAt: new Date() })
			.where(eq(account.userId, userId));
		await database.web.db.insert(account).values({
			id: uniqueId('credential'),
			accountId: userId,
			providerId: 'credential',
			userId,
			updatedAt: new Date(),
		});

		expect(await received()).toEqual([]);
	});

	test('a link moving to another user wakes both; an unlink wakes the user', async () => {
		const from = await signUp();
		const to = await signUp();

		await received();
		await database.web.db
			.update(account)
			.set({ userId: to.userId })
			.where(and(eq(account.userId, from.userId), eq(account.providerId, 'discord')));

		expect(sorted(await received())).toEqual(
			sorted([
				{ channel: 'member_changed', payload: `user:${from.userId}` },
				{ channel: 'member_changed', payload: `user:${to.userId}` },
			]),
		);

		await database.web.db.delete(account).where(eq(account.userId, to.userId));

		expect(await received()).toEqual([
			{ channel: 'member_changed', payload: `user:${to.userId}` },
		]);
	});

	test('deleting a user wakes them once, through the cascade to their links', async () => {
		const { userId } = await signUp();

		await linkGitHub(database.web, userId, 'token');
		await received();
		await database.web.db.delete(user).where(eq(user.id, userId));

		expect(await received()).toEqual([
			{ channel: 'member_changed', payload: `user:${userId}` },
		]);
	});

	test('a sponsorship insert or update wakes the members of its GitHub id', async () => {
		const githubId = uniqueId('gh');

		await seedSponsorship(database.web, { githubId });
		await database.web.db
			.update(sponsorship)
			.set({ state: 'cancelled', endsAt: new Date() })
			.where(eq(sponsorship.githubId, githubId));

		expect(await received()).toEqual([
			{ channel: 'member_changed', payload: `github:${githubId}` },
			{ channel: 'member_changed', payload: `github:${githubId}` },
		]);
	});

	test('an addon insert, a listed field and a delist wake it; updated_at alone does not', async () => {
		const id = await insertAddon();

		expect(await received()).toEqual([{ channel: 'addon_changed', payload: id }]);

		await database.web.db.update(addon).set({ updatedAt: new Date() }).where(eq(addon.id, id));
		await database.web.db.update(addon).set({ name: 'Hello' }).where(eq(addon.id, id));

		expect(await received()).toEqual([]);

		await database.web.db.update(addon).set({ name: 'Renamed' }).where(eq(addon.id, id));

		expect(await received()).toEqual([{ channel: 'addon_changed', payload: id }]);

		await database.web.db.update(addon).set({ delistedAt: new Date() }).where(eq(addon.id, id));

		expect(sorted(await received())).toEqual([
			{ channel: 'addon_changed', payload: id },
			{ channel: 'member_changed', payload: `addon:${id}` },
		]);
	});

	test('deleting an addon wakes it and the maintainers the cascade removes', async () => {
		const { userId } = await signUp();

		await received();

		const id = await insertAddon();

		await database.web.db
			.insert(addonMaintainer)
			.values({ addonId: id, userId, role: 'owner' });

		expect(await received()).toEqual([
			{ channel: 'addon_changed', payload: id },
			{ channel: 'member_changed', payload: `user:${userId}` },
		]);

		await database.web.db.delete(addon).where(eq(addon.id, id));

		expect(sorted(await received())).toEqual([
			{ channel: 'addon_changed', payload: id },
			{ channel: 'member_changed', payload: `user:${userId}` },
		]);
	});

	test('approving a version and withdrawing it wake the addon and its maintainers', async () => {
		const { userId } = await signUp();
		const id = uniqueId('approved');

		await seedApprovedAddon(database.web, userId, manifest(id));
		await received();
		await seedVersion(database.web, userId, manifest(id, '1.1.0'));

		expect(sorted(await received())).toEqual([
			{ channel: 'addon_changed', payload: id },
			{ channel: 'member_changed', payload: `addon:${id}` },
		]);

		const eventId = await insertEvent();

		await received();
		await database.web.db
			.update(addonVersion)
			.set({ withdrawnBy: eventId })
			.where(and(eq(addonVersion.addonId, id), eq(addonVersion.version, '1.1.0')));

		expect(sorted(await received())).toEqual([
			{ channel: 'addon_changed', payload: id },
			{ channel: 'member_changed', payload: `addon:${id}` },
		]);
	});

	test('a moderation event and a first release publish wake their channels; a republish does not', async () => {
		const eventId = await insertEvent();
		const version = uniqueId('1.0');

		await insertRelease(version, 'https://example.com/a.ipa');

		expect(await received()).toEqual([
			{ channel: 'audit_event', payload: String(eventId) },
			{ channel: 'loader_release', payload: `ios:${version}` },
		]);

		await insertRelease(version, 'https://example.com/b.ipa');

		expect(await received()).toEqual([]);
	});

	test('a write in the web serializable transaction notifies once at commit; a rollback notifies nothing', async () => {
		const id = uniqueId('tx');

		await database.web.db.transaction(async (tx) => {
			await tx.insert(addon).values({
				id,
				type: 'plugin',
				name: 'Once',
				description: '',
				updatedAt: new Date(),
			});
			await tx.update(addon).set({ name: 'Twice' }).where(eq(addon.id, id));
		});

		expect(await received()).toEqual([{ channel: 'addon_changed', payload: id }]);

		const rolledBack = database.web.db.transaction(async (tx) => {
			await tx.update(addon).set({ name: 'Never' }).where(eq(addon.id, id));

			throw new Error('rolled back');
		});

		expect(rolledBack).rejects.toThrow('rolled back');
		await rolledBack.catch(() => void 0);
		expect(await received()).toEqual([]);
	});

	test("the bot's own tables send nothing", async () => {
		const { db } = database;
		const name = uniqueId('faq');

		await db.insert(tag).values({ name, content: 'Read the docs.' });
		await db.update(tag).set({ content: 'Read the FAQ.' }).where(eq(tag.name, name));
		await db
			.insert(addonMessage)
			.values({ addonId: uniqueId('a'), channelId: '2', messageId: '3', postedHash: 'h' });
		await db.insert(auditPost).values({ eventId: 999_999, channelId: '2', messageId: '3' });
		await db
			.insert(releasePost)
			.values({ platform: 'ios', version: uniqueId('v'), channelId: '2', messageId: '3' });
		await db.insert(roleGrant).values({ discordId: uniqueId('discord'), role: 'sponsor' });

		expect(await received()).toEqual([]);
	});
});
