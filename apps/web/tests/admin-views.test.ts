import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { createSubmission, finalizeSubmission } from '~/lib/submissions';
import { delistAddon, relistAddon } from '~/lib/addons';
import { getAdminAddon } from '~/lib/admin-addon';
import { addMaintainer } from '~/lib/maintainers';
import { getAdminUser } from '~/lib/admin-users';
import type { AppContext } from '~/lib/context';
import { reviewSubmission } from '~/lib/review';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';
import { user } from '~/db/schema';

import { authRequest, createTestContext, signInWithDiscord, snowflakeAt } from './helpers/context';
import { manifest, seedApprovedAddon, seedVersion } from './helpers/addons';
import { serveMemoryS3 } from './helpers/memory-s3';

const s3 = serveMemoryS3();
const base = createTestContext({ S3_ENDPOINT: s3.url.href });

let clock = new Date('2026-10-23T12:00:00.000Z');

const ctx: AppContext = { ...base.ctx, now: () => clock };

afterAll(async () => {
	await s3.stop(true);
	base.close();
});

let users = 0;

async function signUp(role: Role = 'user') {
	users += 1;

	const name = `Member ${users}`;
	const { userId, headers } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name,
		email: `views-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	const caller: Caller = { user: row, via: 'session' };

	return { userId, name, headers, caller };
}

type Member = Awaited<ReturnType<typeof signUp>>;

function tick() {
	clock = new Date(clock.getTime() + 60_000);

	return clock;
}

async function publish(author: Member, id: string) {
	const bundle = `export default ${JSON.stringify(id)};`;
	const { submission, upload } = await createSubmission(ctx, author.caller, {
		manifest: manifest(id),
		bundleSize: Buffer.byteLength(bundle),
	});

	await fetch(upload.url, { method: upload.method, headers: upload.headers, body: bundle });
	await finalizeSubmission(ctx, author.caller, submission.id);

	return submission.id;
}

function adminAction(moderator: Member, path: string, body: Record<string, string>) {
	return authRequest(ctx, path, {
		method: 'POST',
		headers: moderator.headers,
		body: JSON.stringify(body),
	});
}

function rejection(request: Promise<object | undefined>): Promise<Error | undefined> {
	return request.then(
		() => undefined,
		(error: Error) => error,
	);
}

describe('the admin addon view', () => {
	test('keeps a changes requested round and the later approval as two history entries', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const first = await publish(author, 'views.cycle');

		tick();
		await reviewSubmission(ctx, moderator.caller, first, {
			decision: 'changes_requested',
			note: 'Add a README.',
		});

		tick();

		const second = await publish(author, 'views.cycle');

		tick();
		await reviewSubmission(ctx, moderator.caller, second, {
			decision: 'approved',
			note: 'Thanks.',
		});

		const view = await getAdminAddon(ctx, moderator.caller, 'views.cycle');
		const reviewer = { id: moderator.userId, name: moderator.name, image: null };

		expect(view?.submissions).toMatchObject([
			{
				id: second,
				author: { id: author.userId },
				decisions: [{ decision: 'approved', note: 'Thanks.', reviewer }],
			},
			{
				id: first,
				author: { id: author.userId },
				decisions: [{ decision: 'changes_requested', note: 'Add a README.', reviewer }],
			},
		]);
	});

	test('lists every version newest first by version, not by approval order', async () => {
		const owner = await signUp();
		const moderator = await signUp('moderator');

		await seedApprovedAddon(ctx, owner.userId, manifest('views.versions', '1.0.0'));

		const tenth = await seedVersion(ctx, owner.userId, manifest('views.versions', '1.10.0'));
		const second = await seedVersion(ctx, owner.userId, manifest('views.versions', '1.2.0'));

		const view = await getAdminAddon(ctx, moderator.caller, 'views.versions');

		expect(view?.versions.map((version) => version.version)).toEqual([
			'1.10.0',
			'1.2.0',
			'1.0.0',
		]);
		expect(view?.versions.slice(0, 2).map((version) => version.submissionId)).toEqual([
			tenth.id,
			second.id,
		]);
		expect(view?.addon).toMatchObject({
			id: 'views.versions',
			latestVersion: '1.10.0',
			owners: [{ id: owner.userId }],
		});
	});

	test('shows the moderation events newest first, with their actor and the users they name', async () => {
		const owner = await signUp();
		const helper = await signUp();
		const moderator = await signUp('moderator');

		await seedApprovedAddon(ctx, owner.userId, manifest('views.events'));
		tick();
		await addMaintainer(ctx, owner.caller, 'views.events', helper.userId);
		tick();
		delistAddon(ctx, moderator.caller, 'views.events');
		tick();
		relistAddon(ctx, moderator.caller, 'views.events');

		const view = await getAdminAddon(ctx, moderator.caller, 'views.events');

		expect(view?.events.items.map((event) => [event.kind, event.actor?.id])).toEqual([
			['addon.relisted', moderator.userId],
			['addon.delisted', moderator.userId],
			['addon.maintainers_changed', owner.userId],
		]);
		expect(view?.events.users[helper.userId]).toEqual({
			id: helper.userId,
			name: helper.name,
			image: null,
		});
		expect(view?.maintainers.map((maintainer) => [maintainer.id, maintainer.role])).toEqual([
			[owner.userId, 'owner'],
			[helper.userId, 'maintainer'],
		]);
	});

	test('opens for a moderator but not for a developer, and misses an unknown id', async () => {
		const owner = await signUp();
		const moderator = await signUp('moderator');
		const developer = await signUp('developer');

		await seedApprovedAddon(ctx, owner.userId, manifest('views.access'));

		expect(await getAdminAddon(ctx, moderator.caller, 'views.access')).toBeDefined();
		expect(await getAdminAddon(ctx, moderator.caller, 'views.unknown')).toBeUndefined();
		expect(await rejection(getAdminAddon(ctx, developer.caller, 'views.access'))).toMatchObject(
			{ code: 'forbidden' },
		);
	});
});

describe('the admin user view', () => {
	test('shows the addons they maintain and their submissions', async () => {
		const owner = await signUp();
		const moderator = await signUp('moderator');
		const approved = await seedApprovedAddon(ctx, owner.userId, manifest('views.owned'));

		const view = await getAdminUser(ctx, moderator.caller, owner.userId);

		expect(view?.user).toMatchObject({ id: owner.userId, role: 'developer', banned: false });
		expect(view?.addons).toMatchObject([
			{ id: 'views.owned', role: 'owner', latestVersion: '1.0.0', delistedAt: null },
		]);
		expect(view?.submissions.map((submission) => submission.id)).toEqual([approved.id]);
		expect(await getAdminUser(ctx, moderator.caller, 'no-such-user')).toBeUndefined();
		expect(await rejection(getAdminUser(ctx, owner.caller, moderator.userId))).toMatchObject({
			code: 'forbidden',
		});
	});

	test('records bans, unbans and role changes made through Better Auth, and refused ones not at all', async () => {
		const target = await signUp();
		const moderator = await signUp('moderator');
		const admin = await signUp('admin');

		const banned = await adminAction(moderator, '/admin/ban-user', {
			userId: target.userId,
			banReason: 'Spam submissions',
		});
		const self = await adminAction(moderator, '/admin/ban-user', { userId: moderator.userId });

		await adminAction(moderator, '/admin/unban-user', { userId: target.userId });
		await adminAction(admin, '/admin/set-role', { userId: target.userId, role: 'developer' });

		const view = await getAdminUser(ctx, moderator.caller, target.userId);
		const moderatorView = await getAdminUser(ctx, moderator.caller, moderator.userId);

		expect(banned.status).toBe(200);
		expect(self.status).toBe(400);
		expect(view?.user).toMatchObject({ role: 'developer', banned: false });
		expect(view?.events.items).toMatchObject([
			{ kind: 'user.role_set', actor: { id: admin.userId }, data: { role: 'developer' } },
			{ kind: 'user.unbanned', actor: { id: moderator.userId } },
			{
				kind: 'user.banned',
				subject: { type: 'user', id: target.userId },
				actor: { id: moderator.userId, name: moderator.name },
				reason: 'Spam submissions',
				data: { expiresAt: null },
			},
		]);
		expect(moderatorView?.events.items).toEqual([]);
	});
});
