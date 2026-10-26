import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { addon, addonMaintainer, user } from '~/db/schema';
import { listAdminAddons } from '~/lib/admin-addons';
import { listAdminUsers } from '~/lib/admin-users';
import { toReviewEntry } from '~/lib/review-entry';
import type { Caller } from '~/lib/api/caller';
import { listReviewQueue } from '~/lib/review';
import type { Role } from '~/lib/auth/access';

import { authRequest, createTestContext, signInWithDiscord } from './helpers/context';
import { manifest, seedApprovedAddon, seedSubmission } from './helpers/addons';

const { ctx, close } = await createTestContext({
	ADDON_LIST_PAGE_SIZE: '2',
	USER_LIST_PAGE_SIZE: '2',
});

afterAll(close);

let users = 0;

async function signUp(role: Role = 'user', name: string = `Member ${users + 1}`) {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: `8035111022460${String(users).padStart(4, '0')}`,
		name,
		email: `admin-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	const caller: Caller = { user: row, via: 'session' };

	return { userId, headers, caller };
}

describe('the review queue', () => {
	test('flags the submissions the viewer authored or maintains the addon of', async () => {
		const reviewer = await signUp('moderator');
		const owner = await signUp('developer');
		const other = await signUp('developer');
		const stranger = await signUp();

		await seedApprovedAddon(ctx, owner.userId, manifest('queue.maintained'));
		await seedApprovedAddon(ctx, other.userId, manifest('queue.other'));
		await ctx.db
			.insert(addonMaintainer)
			.values({ addonId: 'queue.maintained', userId: reviewer.userId, role: 'maintainer' });

		const maintained = await seedSubmission(
			ctx,
			owner.userId,
			manifest('queue.maintained', '1.1.0'),
			{ kind: 'update' },
		);
		const own = await seedSubmission(ctx, reviewer.userId, manifest('queue.own-listing'));
		const update = await seedSubmission(ctx, other.userId, manifest('queue.other', '2.0.0'), {
			kind: 'update',
		});
		const listing = await seedSubmission(ctx, stranger.userId, manifest('queue.listing'));

		const { submissions } = await listReviewQueue(ctx, reviewer.caller);
		const flags = new Map(submissions.map((item) => [item.submission.id, item.selfReview]));

		expect([maintained, own, update, listing].map((row) => flags.get(row.id))).toEqual([
			true,
			true,
			false,
			false,
		]);
	});

	test('an update entry diffs its manifest, bundle and ADDON.md against the approved version', async () => {
		const reviewer = await signUp('moderator');
		const owner = await signUp('developer');

		await seedApprovedAddon(ctx, owner.userId, manifest('queue.diffed'), {
			addonMd: '# Hello\r\nSays hello.\r\n',
		});

		const row = await seedSubmission(
			ctx,
			owner.userId,
			manifest('queue.diffed', '1.1.0', { description: 'Says hello louder.' }),
			{ kind: 'update', bundleSize: 2048 },
		);

		const { submissions } = await listReviewQueue(ctx, reviewer.caller, 'update');
		const item = submissions.find((entry) => entry.submission.id === row.id);

		if (!item) {
			throw new Error('The update is not in the queue.');
		}

		const entry = toReviewEntry(item);
		const changed = entry.fields.filter((field) => field.changed).map((field) => field.field);

		expect(entry).toMatchObject({ name: 'Hello', previousVersion: '1.0.0', selfReview: false });
		expect(changed).toEqual(['description', 'version', 'bundle size', 'sha256']);
		expect(entry.addonMdDiff).toEqual({
			state: 'changed',
			lines: [
				{ type: 'context', text: '# Hello', before: 1, after: 1 },
				{ type: 'removed', text: 'Says hello.', before: 2, after: null },
			],
		});
		expect(entry.fields.find((field) => field.field === 'bundle size')).toEqual({
			field: 'bundle size',
			previous: '1,024 bytes',
			next: '2,048 bytes',
			changed: true,
		});
	});

	test('a new listing has no previous version and nothing marked changed', async () => {
		const reviewer = await signUp('moderator');
		const author = await signUp();
		const row = await seedSubmission(ctx, author.userId, manifest('queue.fresh'));

		const { submissions } = await listReviewQueue(ctx, reviewer.caller, 'listing');
		const item = submissions.find((entry) => entry.submission.id === row.id);

		if (!item) {
			throw new Error('The listing is not in the queue.');
		}

		const entry = toReviewEntry(item);

		expect(entry.previousVersion).toBeNull();
		expect(entry.addonMdDiff).toEqual({ state: 'new' });
		expect(entry.fields.some((field) => field.changed)).toBe(false);
		expect(entry.fields.find((field) => field.field === 'authors')?.next).toBe(
			'[{"name":"Mario","id":"1234567890"}]',
		);
	});
});

describe('admin addons', () => {
	test('lists delisted addons too, with owners, and matches the search literally', async () => {
		const moderator = await signUp('moderator');
		const owner = await signUp('developer', 'Addon Owner');

		await seedApprovedAddon(ctx, owner.userId, manifest('staff_search.a'));
		await seedApprovedAddon(ctx, owner.userId, manifest('staffXsearch.b'));
		await ctx.db
			.update(addon)
			.set({ delistedAt: new Date() })
			.where(eq(addon.id, 'staff_search.a'));

		const page = await listAdminAddons(ctx, moderator.caller, { q: '_search' });

		expect(page.items).toMatchObject([
			{
				id: 'staff_search.a',
				name: 'Hello',
				latestVersion: '1.0.0',
				owners: [{ id: owner.userId, name: 'Addon Owner' }],
			},
		]);
		expect(page.items[0]?.delistedAt).not.toBeNull();
	});

	test('needs addon:delist', async () => {
		for (const role of ['user', 'developer'] as const) {
			const caller = await signUp(role);

			const error = await listAdminAddons(ctx, caller.caller, {}).catch((caught) => caught);

			expect(error).toMatchObject({ code: 'forbidden' });
		}
	});
});

describe('admin users', () => {
	test('a moderator searches users by name, newest first', async () => {
		const moderator = await signUp('moderator');
		const older = await signUp('user', 'Searchable Older');
		const newer = await signUp('user', 'Searchable Newer');

		// Sign-ups can land in the same millisecond, so the order is pinned explicitly.
		await ctx.db
			.update(user)
			.set({ createdAt: new Date('2026-01-01T00:00:00.000Z') })
			.where(eq(user.id, older.userId));

		const page = await listAdminUsers(ctx, moderator.caller, { q: 'Searchable' });

		expect(page.items.map((entry) => [entry.id, entry.role, entry.banned])).toEqual([
			[newer.userId, 'user', false],
			[older.userId, 'user', false],
		]);
	});

	test('a plain user or developer cannot list users', async () => {
		for (const role of ['user', 'developer'] as const) {
			const caller = await signUp(role);

			const error = await listAdminUsers(ctx, caller.caller, {}).catch((caught) => caught);

			expect(error).toMatchObject({ code: 'forbidden' });
		}
	});

	test('a moderator bans and unbans through the admin plugin', async () => {
		const moderator = await signUp('moderator');
		const target = await signUp('user', 'Banned Soon');

		const banned = await authRequest(ctx, '/admin/ban-user', {
			method: 'POST',
			headers: moderator.headers,
			body: JSON.stringify({ userId: target.userId, banReason: 'Spam.' }),
		});

		expect(banned.status).toBe(200);
		expect(
			(await listAdminUsers(ctx, moderator.caller, { q: 'Banned Soon' })).items,
		).toMatchObject([{ id: target.userId, banned: true, banReason: 'Spam.' }]);

		const unbanned = await authRequest(ctx, '/admin/unban-user', {
			method: 'POST',
			headers: moderator.headers,
			body: JSON.stringify({ userId: target.userId }),
		});

		expect(unbanned.status).toBe(200);
		expect((await ctx.db.query.user.findFirst({ where: { id: target.userId } }))?.banned).toBe(
			false,
		);
	});
});
