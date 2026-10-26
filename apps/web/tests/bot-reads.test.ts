import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { afterAll, describe, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import { account, addonMaintainer, addonVersion, moderationEvent, user } from '~/db/schema';
import { publishLoaderRelease, withdrawLoaderRelease } from '~/lib/loader-releases';
import { createStaffNote } from '~/lib/staff-notes';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';
import { delistAddon } from '~/lib/addons';
import { createBotReads } from '~/lib/bot';

import {
	authRequest,
	createTestContext,
	linkGitHub,
	signInWithDiscord,
	snowflakeAt,
} from './helpers/context';
import { manifest, seedApprovedAddon, seedSubmission, seedVersion } from './helpers/addons';
import { seedSponsorship } from './helpers/sponsors';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-20T00:00:00.000Z');

const { ctx, close } = await createTestContext();
const reads = createBotReads(ctx.db.$client, {
	siteUrl: 'https://unbound.rip',
	sponsorGraceDays: 7,
	now: () => NOW,
});

afterAll(close);

let users = 0;

async function signUp(role: Role = 'user') {
	users += 1;

	const discordId = snowflakeAt(new Date(Date.UTC(2020, 0, users)));
	const { userId, headers } = await signInWithDiscord(ctx, {
		id: discordId,
		name: `Member ${users}`,
		email: `bot-reads-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	const caller: Caller = { user: row, via: 'session' };

	return { userId, discordId, headers, caller };
}

function seedAddon(ownerId: string, id: string, overrides: Partial<PublishedManifest> = {}) {
	return seedApprovedAddon(ctx, ownerId, manifest(id, '1.0.0', overrides));
}

async function withdraw(addonId: string, version: string) {
	const [event] = await ctx.db
		.insert(moderationEvent)
		.values({
			subjectType: 'addon',
			subjectId: addonId,
			kind: 'addon.rollback',
			data: {},
			createdAt: new Date(),
		})
		.returning({ id: moderationEvent.id });

	await ctx.db
		.update(addonVersion)
		.set({ withdrawnBy: event?.id })
		.where(and(eq(addonVersion.addonId, addonId), eq(addonVersion.version, version)));
}

describe('addons', () => {
	test('reads the public listing, with only an http(s) icon and the page on the site url', async () => {
		const owner = await signUp();

		await seedAddon(owner.userId, 'reads.first', { icon: 'https://cdn.example.com/a.png' });
		await seedAddon(owner.userId, 'reads.second', {
			icon: { uri: 'data:image/png;base64,AA' },
		});

		expect(await reads.addon('reads.first')).toEqual({
			id: 'reads.first',
			type: 'plugin',
			name: 'Hello',
			description: 'Says hello.',
			version: '1.0.0',
			authors: [{ name: 'Mario', discordId: '1234567890' }],
			iconUrl: 'https://cdn.example.com/a.png',
			pageUrl: 'https://unbound.rip/addons/reads.first',
			listed: true,
		});
		expect(await reads.addon('reads.second')).not.toHaveProperty('iconUrl');
		expect(await reads.addon('reads.missing')).toBeUndefined();
	});

	test('serves the newest live version and has nothing to show once every version is withdrawn', async () => {
		const owner = await signUp();

		await seedAddon(owner.userId, 'reads.versions');
		await seedVersion(ctx, owner.userId, manifest('reads.versions', '1.1.0'));

		expect(await reads.addon('reads.versions')).toMatchObject({ version: '1.1.0' });

		await withdraw('reads.versions', '1.1.0');

		expect(await reads.addon('reads.versions')).toMatchObject({ version: '1.0.0' });

		await withdraw('reads.versions', '1.0.0');

		expect(await reads.addon('reads.versions')).toBeUndefined();
		expect((await reads.addons()).map((item) => item.id)).not.toContain('reads.versions');
	});

	test('a delisted addon reads as unlisted, and every addon is listed by addons()', async () => {
		const owner = await signUp();
		const moderator = await signUp('moderator');

		await seedAddon(owner.userId, 'reads.delisted');
		await delistAddon(ctx, moderator.caller, 'reads.delisted');

		expect(await reads.addon('reads.delisted')).toMatchObject({ listed: false });
		expect((await reads.addons()).map((item) => item.id)).toEqual(
			expect.arrayContaining(['reads.first', 'reads.second', 'reads.delisted']),
		);
	});
});

describe('members', () => {
	test('a Discord user is a member; without a Discord link nobody is', async () => {
		const member = await signUp();

		expect(await reads.members({ by: 'user', ids: [member.userId] })).toEqual([
			{
				userId: member.userId,
				discordId: member.discordId,
				githubId: null,
				isAddonDeveloper: false,
				isSponsor: false,
			},
		]);

		await ctx.db
			.delete(account)
			.where(and(eq(account.userId, member.userId), eq(account.providerId, 'discord')));

		expect(await reads.members({ by: 'user', ids: [member.userId] })).toEqual([]);
	});

	test('a sponsorship counts while active or in grace, and not once lapsed', async () => {
		const active = await signUp();
		const grace = await signUp();
		const lapsed = await signUp();

		for (const { userId } of [active, grace, lapsed]) {
			await linkGitHub(ctx, userId, 'token');
		}

		await seedSponsorship(ctx, { githubId: active.userId });
		await seedSponsorship(ctx, {
			githubId: grace.userId,
			state: 'cancelled',
			endsAt: new Date(NOW.getTime() - 6 * DAY_MS),
		});
		await seedSponsorship(ctx, {
			githubId: lapsed.userId,
			state: 'cancelled',
			endsAt: new Date(NOW.getTime() - 8 * DAY_MS),
		});

		const members = await reads.members({
			by: 'user',
			ids: [active.userId, grace.userId, lapsed.userId],
		});

		expect(members.map((row) => [row.userId, row.githubId, row.isSponsor])).toEqual(
			expect.arrayContaining([
				[active.userId, active.userId, true],
				[grace.userId, grace.userId, true],
				[lapsed.userId, lapsed.userId, false],
			]),
		);
		expect(members).toHaveLength(3);
	});

	test('an addon developer maintains a listed addon with a live version', async () => {
		const owner = await signUp();
		const helper = await signUp();
		const moderator = await signUp('moderator');

		await seedAddon(owner.userId, 'members.addon');
		await ctx.db
			.insert(addonMaintainer)
			.values({ addonId: 'members.addon', userId: helper.userId, role: 'maintainer' });

		const developers = await reads.members({ by: 'addon', ids: ['members.addon'] });

		expect(developers.map((row) => [row.userId, row.isAddonDeveloper])).toEqual(
			expect.arrayContaining([
				[owner.userId, true],
				[helper.userId, true],
			]),
		);

		await delistAddon(ctx, moderator.caller, 'members.addon');

		expect(
			(await reads.members({ by: 'addon', ids: ['members.addon'] })).map(
				(row) => row.isAddonDeveloper,
			),
		).toEqual([false, false]);

		await seedAddon(owner.userId, 'members.withdrawn');
		await withdraw('members.withdrawn', '1.0.0');

		expect(await reads.members({ by: 'user', ids: [owner.userId] })).toMatchObject([
			{ isAddonDeveloper: false },
		]);
	});

	test('a query by Discord or GitHub id names the same member; all includes them', async () => {
		const member = await signUp();

		await linkGitHub(ctx, member.userId, 'token');

		const [byDiscord] = await reads.members({ by: 'discord', ids: [member.discordId] });
		const [byGitHub] = await reads.members({ by: 'github', ids: [member.userId] });

		expect(byDiscord?.userId).toBe(member.userId);
		expect(byGitHub).toEqual(byDiscord);
		expect((await reads.members({ by: 'all' })).map((row) => row.userId)).toContain(
			member.userId,
		);
		expect(await reads.members({ by: 'user', ids: [] })).toEqual([]);
	});
});

describe('releases', () => {
	test('reads a release until it is withdrawn, and lists releases since a moment in publish order', async () => {
		const ci = await signUp('ci');
		const since = new Date();

		// Android first, so a publish time tie, broken by platform, keeps the same order.
		await publishLoaderRelease(ctx, ci.caller, {
			platform: 'android',
			version: '3.0.0',
			url: 'https://example.com/android',
		});
		await publishLoaderRelease(ctx, ci.caller, {
			platform: 'ios',
			version: '3.0.0',
			url: 'https://example.com/ios',
		});

		expect(await reads.release({ platform: 'ios', version: '3.0.0' })).toEqual({
			platform: 'ios',
			version: '3.0.0',
			url: 'https://example.com/ios',
			changelog: null,
			publishedAt: expect.any(Date),
		});
		expect(
			(await reads.releasesSince(since)).map((release) => [release.platform, release.url]),
		).toEqual([
			['android', 'https://example.com/android'],
			['ios', 'https://example.com/ios'],
		]);
		expect(await reads.releasesSince(new Date(Date.now() + DAY_MS))).toEqual([]);

		await withdrawLoaderRelease(ctx, ci.caller, 'ios', '3.0.0');

		expect(await reads.release({ platform: 'ios', version: '3.0.0' })).toBeUndefined();
	});
});

describe('events', () => {
	test('reads the log after an id, oldest first, naming subjects and keeping unknown shapes raw', async () => {
		const owner = await signUp();
		const moderator = await signUp('moderator');

		await seedAddon(owner.userId, 'events.reads');

		const after = await reads.newestEventId();
		const event = {
			subjectType: 'addon',
			subjectId: 'events.reads',
			actorId: moderator.userId,
			data: {},
			createdAt: new Date(),
		} as const;

		await ctx.db.insert(moderationEvent).values({ ...event, kind: 'addon.delisted' });
		await ctx.db
			.insert(moderationEvent)
			.values({ ...event, kind: 'review.decided', data: { unexpected: true } });
		await ctx.db
			.insert(moderationEvent)
			.values({ ...event, subjectType: 'user', subjectId: 'gone', kind: 'user.unbanned' });

		const events = await reads.eventsAfter(after, 10);

		expect(events).toEqual([
			{
				id: expect.any(Number),
				kind: 'addon.delisted',
				subjectType: 'addon',
				subjectId: 'events.reads',
				subjectName: 'Hello',
				actor: { id: moderator.userId, name: moderator.caller.user.name },
				data: {},
				reason: null,
				createdAt: event.createdAt,
			},
			expect.objectContaining({ kind: 'review.decided', data: { unexpected: true } }),
			expect.objectContaining({ kind: 'user.unbanned', subjectName: null }),
		]);
		expect((await reads.eventsAfter(after, 2)).map((row) => row.kind)).toEqual([
			'addon.delisted',
			'review.decided',
		]);
		expect(await reads.eventsAfter(events.at(-1)?.id ?? 0, 10)).toEqual([]);
		expect(await reads.newestEventId()).toBe(events.at(-1)?.id ?? -1);
	});

	test('deleting a user logs one user.deleted with what the cascade removes', async () => {
		const doomed = await signUp();
		const admin = await signUp('admin');

		// Legacy uploads: a GitHub-sourced submission's source row blocks the cascade.
		await seedSubmission(ctx, doomed.userId, manifest('events.doomed'), {}, null);
		await seedSubmission(
			ctx,
			doomed.userId,
			manifest('events.doomed.old'),
			{ status: 'rejected' },
			null,
		);
		await createStaffNote(ctx, admin.caller, {
			subject: { type: 'user', id: doomed.userId },
			body: 'Spam account.',
		});

		const after = await reads.newestEventId();
		const removed = await authRequest(ctx, '/admin/remove-user', {
			method: 'POST',
			headers: admin.headers,
			body: JSON.stringify({ userId: doomed.userId }),
		});

		expect(removed.status).toBe(200);
		expect(await ctx.db.query.user.findFirst({ where: { id: doomed.userId } })).toBeUndefined();
		expect(await reads.eventsAfter(after, 10)).toEqual([
			{
				id: expect.any(Number),
				kind: 'user.deleted',
				subjectType: 'user',
				subjectId: doomed.userId,
				subjectName: null,
				actor: { id: admin.userId, name: admin.caller.user.name },
				data: { openSubmissions: 1, staffNotes: 1 },
				reason: null,
				createdAt: expect.any(Date),
			},
		]);
	});

	test('a user delete the database refuses records nothing', async () => {
		const kept = await signUp();
		const admin = await signUp('admin');

		await seedSubmission(ctx, kept.userId, manifest('events.kept'));

		const after = await reads.newestEventId();
		const removed = await authRequest(ctx, '/admin/remove-user', {
			method: 'POST',
			headers: admin.headers,
			body: JSON.stringify({ userId: kept.userId }),
		});

		expect(removed.ok).toBe(false);
		expect(await ctx.db.query.user.findFirst({ where: { id: kept.userId } })).toBeDefined();
		expect(await reads.eventsAfter(after, 10)).toEqual([]);
	});
});
