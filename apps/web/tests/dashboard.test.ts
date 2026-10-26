import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import type { Dashboard, DashboardAddon } from '~/lib/dashboard';
import { TIMELINE_LIMIT, loadDashboard } from '~/lib/dashboard';
import { addon, addonMaintainer, user } from '~/db/schema';
import type { AppContext } from '~/lib/context';
import type { Role } from '~/lib/auth/access';

import { manifest, seedApprovedAddon, seedSubmission } from './helpers/addons';
import { createTestContext, signInWithDiscord } from './helpers/context';

const NOW = new Date('2026-10-17T12:00:00.000Z');

const base = await createTestContext();
const ctx: AppContext = { ...base.ctx, now: () => NOW };

let users = 0;

afterAll(() => base.close());

async function signUp(role: Role = 'user'): Promise<string> {
	users += 1;

	const { userId } = await signInWithDiscord(ctx, {
		id: `8035111022470${String(users).padStart(4, '0')}`,
		name: `Developer ${users}`,
		email: `dashboard-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	return userId;
}

async function dashboardOf(userId: string): Promise<Dashboard> {
	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	return loadDashboard(ctx, { user: row, via: 'session' }, false);
}

function rowOf(dashboard: Dashboard, id: string): DashboardAddon {
	const row = dashboard.addons.find((entry) => entry.id === id);

	if (!row) {
		throw new Error(`No dashboard row for ${id}.`);
	}

	return row;
}

function minutesAgo(minutes: number): Date {
	return new Date(NOW.getTime() - minutes * 60_000);
}

describe('dashboard rows', () => {
	test('shows approved addons as published rows and open listings as listing rows', async () => {
		const owner = await signUp();

		await seedApprovedAddon(ctx, owner, manifest('rows.live', '1.0.0', { name: 'Live' }));
		await seedSubmission(ctx, owner, manifest('rows.new', '0.1.0', { name: 'Fresh' }));

		const dashboard = await dashboardOf(owner);
		const live = rowOf(dashboard, 'rows.live');
		const listing = rowOf(dashboard, 'rows.new');

		expect(live).toMatchObject({
			kind: 'published',
			name: 'Live',
			role: 'owner',
			visibility: 'listed',
			live: { version: '1.0.0', publishedAt: NOW.toISOString() },
			pending: null,
			actions: { submit: 'update', maintainers: true, publicPage: true, staffManage: false },
		});
		expect(listing).toMatchObject({
			kind: 'listing',
			name: 'Fresh',
			pending: { version: '0.1.0', status: 'pending_review', mine: true },
			actions: { submit: null, maintainers: false, publicPage: false, staffManage: false },
		});
	});

	test('reads visibility from delistedAt', async () => {
		const owner = await signUp();

		await seedApprovedAddon(ctx, owner, manifest('rows.delisted'));
		await ctx.db.update(addon).set({ delistedAt: NOW }).where(eq(addon.id, 'rows.delisted'));

		expect(rowOf(await dashboardOf(owner), 'rows.delisted')).toMatchObject({
			visibility: 'delisted',
			actions: { publicPage: false },
		});
	});

	test('shows changes requested over a submission in review, and offers republish', async () => {
		const owner = await signUp();
		const helper = await signUp('developer');

		await seedApprovedAddon(ctx, owner, manifest('rows.urgent'));
		await ctx.db
			.insert(addonMaintainer)
			.values({ addonId: 'rows.urgent', userId: helper, role: 'maintainer' });
		await seedSubmission(ctx, helper, manifest('rows.urgent', '1.1.0'), { kind: 'update' });
		await seedSubmission(ctx, owner, manifest('rows.urgent', '1.2.0'), {
			kind: 'update',
			status: 'changes_requested',
			reviewDecision: 'changes_requested',
			reviewedAt: NOW,
			reviewNote: 'Fix the contrast.',
		});

		expect(rowOf(await dashboardOf(owner), 'rows.urgent')).toMatchObject({
			pending: {
				version: '1.2.0',
				status: 'changes_requested',
				mine: true,
				note: 'Fix the contrast.',
			},
			actions: { submit: 'republish' },
		});
		expect(rowOf(await dashboardOf(helper), 'rows.urgent')).toMatchObject({
			role: 'maintainer',
			pending: { status: 'changes_requested', mine: false },
			actions: { submit: 'update', maintainers: false },
		});
	});

	test('republishing reads the repository and addon directory of the pending submission again', async () => {
		const owner = await signUp();

		await seedSubmission(
			ctx,
			owner,
			manifest('rows.republish'),
			{ status: 'changes_requested', reviewNote: 'Fix it.' },
			{ repository: 'acme/republish', path: 'themes/republish' },
		);

		expect(rowOf(await dashboardOf(owner), 'rows.republish')).toMatchObject({
			pending: { source: { repository: 'acme/republish', path: 'themes/republish' } },
			actions: { submit: 'republish' },
		});
	});

	test('offers no update without the update permission', async () => {
		const owner = await signUp();
		const member = await signUp();

		await seedApprovedAddon(ctx, owner, manifest('rows.no-update'));
		await ctx.db
			.insert(addonMaintainer)
			.values({ addonId: 'rows.no-update', userId: member, role: 'maintainer' });

		expect(rowOf(await dashboardOf(member), 'rows.no-update').actions.submit).toBeNull();
	});

	test('links staff with addon:delist to the admin page', async () => {
		const owner = await signUp();

		await seedApprovedAddon(ctx, owner, manifest('rows.staff'));
		await ctx.db.update(user).set({ role: 'moderator' }).where(eq(user.id, owner));

		expect(rowOf(await dashboardOf(owner), 'rows.staff').actions.staffManage).toBe(true);
	});
});

describe('the submission timeline', () => {
	test('shows reviewed submissions newest first and skips expired ones', async () => {
		const owner = await signUp();

		await seedApprovedAddon(ctx, owner, manifest('timeline.main', '1.0.0', { name: 'Main' }));
		await ctx.db.update(addon).set({ name: 'Renamed' }).where(eq(addon.id, 'timeline.main'));

		const updated = manifest('timeline.main', '1.1.0', { name: 'Main' });
		const superseded = await seedSubmission(ctx, owner, updated, {
			kind: 'update',
			status: 'superseded',
			submittedAt: minutesAgo(30),
			reviewDecision: 'changes_requested',
			reviewedAt: minutesAgo(20),
			reviewNote: 'Drop the token access.',
		});
		const expired = await seedSubmission(ctx, owner, manifest('timeline.main', '1.2.0'), {
			kind: 'update',
			status: 'expired',
			submittedAt: minutesAgo(5),
		});
		const rejected = await seedSubmission(
			ctx,
			owner,
			manifest('timeline.rejected', '0.1.0', { name: 'Auto Nitro' }),
			{
				status: 'rejected',
				submittedAt: minutesAgo(15),
				reviewDecision: 'rejected',
				reviewedAt: minutesAgo(10),
				reviewNote: 'It cannot be listed.',
			},
		);

		const { timeline } = await dashboardOf(owner);
		const ids = timeline.map((entry) => entry.id);

		expect(ids).not.toContain(expired.id);
		expect(ids.indexOf(rejected.id)).toBeLessThan(ids.indexOf(superseded.id));
		expect(timeline.find((entry) => entry.id === superseded.id)).toMatchObject({
			name: 'Main',
			kind: 'update',
			outcome: 'changes_requested',
			note: 'Drop the token access.',
			at: minutesAgo(20).toISOString(),
		});
		expect(timeline.find((entry) => entry.id === rejected.id)).toMatchObject({
			name: 'Auto Nitro',
			kind: 'listing',
			outcome: 'rejected',
		});
	});

	test(`caps the timeline at ${TIMELINE_LIMIT} entries`, async () => {
		const author = await signUp();
		const total = TIMELINE_LIMIT + 2;

		for (let i = 0; i < total; i++) {
			await seedSubmission(ctx, author, manifest(`timeline.cap-${i}`), {
				status: 'rejected',
				submittedAt: minutesAgo(total - i),
				reviewDecision: 'rejected',
				reviewedAt: minutesAgo(total - i),
			});
		}

		const { timeline } = await dashboardOf(author);

		expect(timeline).toHaveLength(TIMELINE_LIMIT);
		expect(timeline[0]?.addonId).toBe(`timeline.cap-${total - 1}`);
	});

	test("does not show another user's listing of an addon the viewer maintains", async () => {
		const stranger = await signUp();
		const owner = await signUp();

		const foreign = await seedSubmission(ctx, stranger, manifest('timeline.claimed'), {
			status: 'rejected',
			reviewDecision: 'rejected',
			reviewedAt: NOW,
			reviewNote: 'Not yours.',
		});

		await seedApprovedAddon(ctx, owner, manifest('timeline.claimed'));

		const dashboard = await dashboardOf(owner);

		expect(dashboard.timeline.map((entry) => entry.id)).not.toContain(foreign.id);
		expect(dashboard.addons.map((entry) => entry.id)).toEqual(['timeline.claimed']);
	});
});
