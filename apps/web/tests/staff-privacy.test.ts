import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { getAdminUser, listAdminUsers } from '~/lib/admin-users';
import type { DiscordId } from '~/db/schema';
import { teamMember, user } from '~/db/schema';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';

import { authRequest, createTestContext, signInWithDiscord } from './helpers/context';

const { ctx, close } = await createTestContext();

afterAll(close);

let users = 0;

async function signUp(role: Role = 'user') {
	users += 1;

	const discordId: DiscordId = `${8_035_111_022_480_000 + users}`;
	const email = `privacy-${users}@example.com`;
	const { userId, headers } = await signInWithDiscord(ctx, {
		id: discordId,
		name: `Privacy Member ${users}`,
		email,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	const caller: Caller = { user: row, via: 'session' };

	return { userId, discordId, email, headers, caller };
}

type Member = Awaited<ReturnType<typeof signUp>>;

async function joinDevelopmentTeam(member: Member) {
	await ctx.db.insert(teamMember).values({
		discordId: member.discordId,
		group: 'development-team',
		staffRole: 'admin',
		syncedAt: ctx.now(),
	});

	return member;
}

function post(member: Member, path: string, body: object) {
	return authRequest(ctx, path, {
		method: 'POST',
		headers: member.headers,
		body: JSON.stringify(body),
	});
}

async function storedRole(userId: string) {
	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	return row?.role;
}

async function emailsSeenBy(viewer: Member, target: Member) {
	const listed = await listAdminUsers(ctx, viewer.caller, { q: `Privacy Member` });
	const page = await getAdminUser(ctx, viewer.caller, target.userId);

	return {
		listed: listed.items.find((entry) => entry.id === target.userId)?.email,
		page: page?.user.email,
	};
}

describe('user emails', () => {
	test('only the development team sees them', async () => {
		const target = await signUp();
		const moderator = await signUp('moderator');
		const admin = await signUp('admin');
		const developer = await joinDevelopmentTeam(await signUp('admin'));

		expect(await emailsSeenBy(moderator, target)).toEqual({ listed: null, page: null });
		expect(await emailsSeenBy(admin, target)).toEqual({ listed: null, page: null });
		expect(await emailsSeenBy(developer, target)).toEqual({
			listed: target.email,
			page: target.email,
		});
	});

	test('searching by email finds nobody outside the development team', async () => {
		const target = await signUp();
		const admin = await signUp('admin');
		const developer = await joinDevelopmentTeam(await signUp('admin'));
		const q = target.email.slice(0, -4);

		expect((await listAdminUsers(ctx, admin.caller, { q })).items).toEqual([]);
		expect(
			(await listAdminUsers(ctx, developer.caller, { q })).items.map((row) => row.id),
		).toEqual([target.userId]);
	});

	test('the admin plugin does not read users', async () => {
		const target = await signUp();
		const moderator = await signUp('moderator');
		const admin = await signUp('admin');

		for (const viewer of [moderator, admin]) {
			const listed = await authRequest(ctx, '/admin/list-users', { headers: viewer.headers });
			const fetched = await authRequest(ctx, `/admin/get-user?id=${target.userId}`, {
				headers: viewer.headers,
			});

			expect([listed.status, fetched.status]).toEqual([403, 403]);
			expect(await listed.text()).not.toContain('@example.com');
			expect(await fetched.text()).not.toContain('@example.com');
		}
	});
});

describe('role changes', () => {
	test.each(['admin', 'user'] as const)(
		'an admin cannot set their own role to %s',
		async (role) => {
			const admin = await signUp('admin');
			const response = await post(admin, '/admin/set-role', { userId: admin.userId, role });

			expect(response.status).toBe(403);
			expect(await storedRole(admin.userId)).toBe('admin');
		},
	);

	test("an admin still sets someone else's role", async () => {
		const admin = await signUp('admin');
		const target = await signUp();
		const response = await post(admin, '/admin/set-role', {
			userId: target.userId,
			role: 'moderator',
		});

		expect(response.status).toBe(200);
		expect(await storedRole(target.userId)).toBe('moderator');
	});

	test('a user cannot give themselves a role through their profile', async () => {
		const member = await signUp('moderator');
		const response = await post(member, '/update-user', { role: 'admin' });

		expect(response.ok).toBe(false);
		expect(await storedRole(member.userId)).toBe('moderator');
	});

	test('the admin plugin cannot set roles, create users or impersonate', async () => {
		const admin = await signUp('admin');
		const target = await signUp();
		const developer = await joinDevelopmentTeam(await signUp('admin'));
		const attempts: [string, object][] = [
			['/admin/update-user', { userId: admin.userId, data: { role: 'admin,ci' } }],
			['/admin/update-user', { userId: target.userId, data: { role: 'admin' } }],
			['/admin/create-user', { email: 'sock@example.com', name: 'Sock', role: 'admin' }],
			['/admin/impersonate-user', { userId: developer.userId }],
			[
				'/admin/set-user-password',
				{ userId: developer.userId, newPassword: 'hunter2hunter2' },
			],
		];

		for (const [path, body] of attempts) {
			expect({ path, status: (await post(admin, path, body)).status }).toEqual({
				path,
				status: 403,
			});
		}

		expect(await storedRole(admin.userId)).toBe('admin');
		expect(await storedRole(target.userId)).toBe('user');
		expect(await ctx.db.query.user.findFirst({ where: { email: 'sock@example.com' } })).toBe(
			undefined,
		);
	});
});
