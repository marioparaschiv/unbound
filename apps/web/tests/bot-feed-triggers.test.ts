import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { afterAll, describe, expect, test } from 'bun:test';
import { and, eq, max } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	account,
	addon,
	addonMaintainer,
	addonVersion,
	botFeedChange,
	loaderRelease,
	sponsorship,
	user,
} from '~/db/schema';
import { MIGRATIONS_FOLDER, migrateDatabase } from '~/db/migrate';
import type { BotFeed } from '~/db/schema/bot';
import { createDatabase } from '~/db/database';

import { createTestContext, linkGitHub, signInWithDiscord, snowflakeAt } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';
import { seedSponsorship } from './helpers/sponsors';

const TRIGGERS_MIGRATION_SUFFIX = '_bot_feed_triggers';

type TriggerRow = {
	sql: string;
};

const { ctx, close } = createTestContext();

afterAll(close);

let users = 0;

async function signUp() {
	users += 1;

	const { userId } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name: `Member ${users}`,
		email: `triggers-${users}@example.com`,
	});

	return userId;
}

function seqOf(feed: BotFeed, key: string): number | undefined {
	return ctx.db
		.select({ seq: botFeedChange.seq })
		.from(botFeedChange)
		.where(and(eq(botFeedChange.feed, feed), eq(botFeedChange.key, key)))
		.get()?.seq;
}

function latestSeq(feed: BotFeed): number {
	return (
		ctx.db
			.select({ seq: max(botFeedChange.seq) })
			.from(botFeedChange)
			.where(eq(botFeedChange.feed, feed))
			.get()?.seq ?? 0
	);
}

/** Whether running `change` moved `key` past every key its feed had before. */
async function moves(feed: BotFeed, key: string, change: () => unknown): Promise<boolean> {
	const before = latestSeq(feed);

	await change();

	return (seqOf(feed, key) ?? 0) > before;
}

describe('addon triggers', () => {
	test('an approval, a staff update and a withdrawn version each move the addon', async () => {
		const owner = await signUp();

		expect(
			await moves('addons', 'triggers.addon', () =>
				seedApprovedAddon(ctx, owner, manifest('triggers.addon')),
			),
		).toBe(true);
		expect(
			await moves('addons', 'triggers.addon', () =>
				ctx.db.update(addon).set({ name: 'Renamed' }).where(eq(addon.id, 'triggers.addon')),
			),
		).toBe(true);
		expect(
			await moves('addons', 'triggers.addon', () =>
				ctx.db
					.update(addonVersion)
					.set({ withdrawnBy: null })
					.where(eq(addonVersion.addonId, 'triggers.addon')),
			),
		).toBe(true);
	});
});

describe('member triggers', () => {
	test('a delist, a new version and a maintainer change move the maintainers', async () => {
		const owner = await signUp();
		const helper = await signUp();

		await seedApprovedAddon(ctx, owner, manifest('triggers.members'));

		expect(
			await moves('members', owner, () =>
				ctx.db
					.update(addon)
					.set({ delistedAt: new Date() })
					.where(eq(addon.id, 'triggers.members')),
			),
		).toBe(true);
		expect(
			await moves('members', helper, () =>
				ctx.db
					.insert(addonMaintainer)
					.values({ addonId: 'triggers.members', userId: helper, role: 'maintainer' }),
			),
		).toBe(true);
		expect(
			await moves('members', helper, () =>
				ctx.db
					.delete(addonMaintainer)
					.where(
						and(
							eq(addonMaintainer.addonId, 'triggers.members'),
							eq(addonMaintainer.userId, helper),
						),
					),
			),
		).toBe(true);
		expect(
			await moves('members', owner, () =>
				ctx.db
					.update(addonVersion)
					.set({ withdrawnBy: null })
					.where(eq(addonVersion.addonId, 'triggers.members')),
			),
		).toBe(true);
	});

	test('linking and unlinking move the user; a token refresh does not', async () => {
		const member = await signUp();

		expect(await moves('members', member, () => linkGitHub(ctx, member, 'token'))).toBe(true);
		expect(
			await moves('members', member, () =>
				ctx.db
					.update(account)
					.set({ accessToken: 'refreshed' })
					.where(eq(account.userId, member)),
			),
		).toBe(false);
		expect(
			await moves('members', member, () =>
				ctx.db
					.delete(account)
					.where(and(eq(account.userId, member), eq(account.providerId, 'discord'))),
			),
		).toBe(true);
	});

	test('a sponsorship starting, changing and ending moves its GitHub user', async () => {
		const member = await signUp();

		await linkGitHub(ctx, member, 'token');

		expect(
			await moves('members', member, () => seedSponsorship(ctx, { githubId: member })),
		).toBe(true);
		expect(
			await moves('members', member, () =>
				ctx.db
					.update(sponsorship)
					.set({ state: 'cancelled' })
					.where(eq(sponsorship.githubId, member)),
			),
		).toBe(true);
		expect(
			await moves('members', member, () =>
				ctx.db.delete(sponsorship).where(eq(sponsorship.githubId, member)),
			),
		).toBe(true);
	});

	test('deleting a user fires the account triggers through the cascade', async () => {
		const member = await signUp();
		const trigger = ctx.db.$client
			.query<TriggerRow, []>(
				"SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'bot_feed_user_delete'",
			)
			.get();

		if (!trigger) {
			throw new Error('The user delete trigger is missing.');
		}

		// Without the user's own trigger, only the cascaded account deletes can move the member.
		ctx.db.$client.run('DROP TRIGGER `bot_feed_user_delete`');

		try {
			expect(
				await moves('members', member, () =>
					ctx.db.delete(user).where(eq(user.id, member)),
				),
			).toBe(true);
		} finally {
			ctx.db.$client.run(trigger.sql);
		}
	});
});

describe('release triggers', () => {
	test('publishing, republishing and withdrawing move the release', async () => {
		const release = {
			platform: 'ios',
			version: '1.2.0',
			versionKey: '1.2.0',
			url: 'https://example.com/1.2.0',
			publishedAt: new Date(),
		} as const;
		const where = and(eq(loaderRelease.platform, 'ios'), eq(loaderRelease.version, '1.2.0'));

		expect(
			await moves('releases', 'ios:1.2.0', () =>
				ctx.db.insert(loaderRelease).values(release),
			),
		).toBe(true);
		expect(
			await moves('releases', 'ios:1.2.0', () =>
				ctx.db.update(loaderRelease).set({ changelog: 'Fixes.' }).where(where),
			),
		).toBe(true);
		expect(
			await moves('releases', 'ios:1.2.0', () => ctx.db.delete(loaderRelease).where(where)),
		).toBe(true);
	});
});

describe('bot feed triggers migration', () => {
	test('backfills every addon, linked user and release', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'ub-bot-feed-'));
		const previous = join(directory, 'migrations');
		const migrations = (await readdir(MIGRATIONS_FOLDER)).toSorted();
		const applied = migrations.slice(
			0,
			migrations.findIndex((name) => name.endsWith(TRIGGERS_MIGRATION_SUFFIX)),
		);
		const db = createDatabase(join(directory, 'app.db'));

		try {
			for (const name of applied) {
				await cp(join(MIGRATIONS_FOLDER, name), join(previous, name), { recursive: true });
			}

			migrate(db, { migrationsFolder: previous });

			db.$client.run(
				`INSERT INTO user (id, name, email) VALUES ('u', 'U', 'u@example.com'), ('bare', 'B', 'b@example.com')`,
			);
			db.$client.run(
				`INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ('d', '1', 'discord', 'u', 0), ('g', '2', 'github', 'u', 0)`,
			);
			db.$client.run(
				`INSERT INTO addon (id, type, name, description, updated_at) VALUES ('old.addon', 'plugin', 'Old', '', 0)`,
			);
			db.$client.run(
				`INSERT INTO loader_release (platform, version, version_key, url, published_at) VALUES ('android', '1.0.0', '1.0.0', 'https://example.com', 0)`,
			);

			migrateDatabase(db);

			const rows = db
				.select({ feed: botFeedChange.feed, key: botFeedChange.key })
				.from(botFeedChange)
				.all();

			expect(rows.toSorted((a, b) => a.feed.localeCompare(b.feed))).toEqual([
				{ feed: 'addons', key: 'old.addon' },
				{ feed: 'members', key: 'u' },
				{ feed: 'releases', key: 'android:1.0.0' },
			]);
		} finally {
			db.$client.close();
			await rm(directory, { recursive: true });
		}
	});
});
