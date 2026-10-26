import { afterAll, describe, expect, test } from 'bun:test';
import { and, eq, max } from 'drizzle-orm';

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
import type { BotFeed } from '~/db/schema/bot';

import { createTestContext, linkGitHub, signInWithDiscord, snowflakeAt } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';
import { seedSponsorship } from './helpers/sponsors';

type TriggerRow = {
	definition: string;
};

/** A write under test: a query builder, a promise or a synchronous seed. */
type Change = () => PromiseLike<object | void> | void;

const { ctx, close } = await createTestContext();

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

async function seqOf(feed: BotFeed, key: string): Promise<number | undefined> {
	const [row] = await ctx.db
		.select({ seq: botFeedChange.seq })
		.from(botFeedChange)
		.where(and(eq(botFeedChange.feed, feed), eq(botFeedChange.key, key)));

	return row?.seq;
}

async function latestSeq(feed: BotFeed): Promise<number> {
	const [row] = await ctx.db
		.select({ seq: max(botFeedChange.seq) })
		.from(botFeedChange)
		.where(eq(botFeedChange.feed, feed));

	return row?.seq ?? 0;
}

/** Whether running `change` moved `key` past every key its feed had before. */
async function moves(feed: BotFeed, key: string, change: Change): Promise<boolean> {
	const before = await latestSeq(feed);

	await change();

	return ((await seqOf(feed, key)) ?? 0) > before;
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
		const [trigger] = await ctx.db.$client<TriggerRow[]>`
			SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger
			WHERE tgname = 'bot_feed_user_delete' AND tgrelid = '"user"'::regclass`;

		if (!trigger) {
			throw new Error('The user delete trigger is missing.');
		}

		// Without the user's own trigger, only the cascaded account deletes can move the member.
		await ctx.db.$client`DROP TRIGGER bot_feed_user_delete ON "user"`;

		try {
			expect(
				await moves('members', member, () =>
					ctx.db.delete(user).where(eq(user.id, member)),
				),
			).toBe(true);
		} finally {
			await ctx.db.$client.unsafe(trigger.definition);
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
