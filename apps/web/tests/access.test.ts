import { afterAll, describe, expect, test } from 'bun:test';

import type { Permissions, Role } from '~/lib/auth/access';
import { hasPermission } from '~/lib/auth/access';

import { createTestContext } from './helpers/context';

type Case = [role: Role, permissions: Permissions, granted: boolean];

const cases: Case[] = [
	['user', { submission: ['create'] }, true],
	['user', { submission: ['review'] }, false],
	['user', { update: ['create'] }, false],
	['developer', { update: ['create'] }, true],
	['developer', { update: ['review'] }, false],
	['moderator', { submission: ['review'] }, true],
	['moderator', { update: ['review'] }, true],
	['moderator', { addon: ['delist'] }, true],
	['moderator', { user: ['ban'] }, true],
	['moderator', { user: ['set-role'] }, false],
	['moderator', { addon: ['transfer'] }, false],
	['moderator', { loader: ['publish'] }, false],
	['moderator', { note: ['read', 'write'] }, true],
	['developer', { note: ['read'] }, false],
	['ci', { loader: ['publish'] }, true],
	['ci', { submission: ['create'] }, false],
	['ci', { addon: ['delist'] }, false],
	['admin', { user: ['set-role'] }, true],
	['admin', { loader: ['publish'] }, true],
	['admin', { addon: ['transfer', 'delist'] }, true],
	['admin', { note: ['read', 'write'] }, true],
];

describe('hasPermission', () => {
	test.each(cases)('%s with %o is %p', (role, permissions, granted) => {
		expect(hasPermission(role, permissions)).toBe(granted);
	});

	test('a comma-separated role passes if any one role grants the permissions', () => {
		expect(hasPermission('user,moderator', { submission: ['review'] })).toBe(true);
	});

	test('an unknown role grants nothing and an unset role falls back to user', () => {
		expect(hasPermission('unknown', { submission: ['create'] })).toBe(false);
		expect(hasPermission(null, { submission: ['create'] })).toBe(true);
		expect(hasPermission(undefined, { submission: ['review'] })).toBe(false);
	});
});

describe('admin plugin access control', () => {
	const { ctx, close } = createTestContext();

	afterAll(close);

	// The admin plugin's own check, which its endpoints (ban, set-role, ...) enforce, agrees.
	test.each(cases)('%s with %o is %p', async (role, permissions, granted) => {
		const result = await ctx.auth.api.userHasPermission({ body: { role, permissions } });

		expect(result.success).toBe(granted);
	});
});
