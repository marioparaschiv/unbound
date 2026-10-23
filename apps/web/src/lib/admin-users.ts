import type { AdminUsersSearch } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { afterKey, decodeCursor, scanOrder, toKeysetPage } from '~/lib/keyset';
import { requirePermission } from '~/lib/api/caller';
import { matchesSearch } from '~/lib/admin-search';
import { DEFAULT_ROLE } from '~/lib/auth/access';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import type { KeysetPage } from '~/lib/keyset';

export type AdminUser = {
	id: string;
	name: string;
	email: string;
	image: string | null;
	role: string;
	banned: boolean;
	banReason: string | null;
	createdAt: Date;
};

export type AdminUsersPage = KeysetPage<AdminUser>;

const USER_CURSOR = z.tuple([z.int(), z.string().min(1)]);

/**
 * @description Builds the one statement behind {@link listAdminUsers}: one page plus a lookahead row,
 * newest first by `(created_at, id)`.
 * @param ctx The application context.
 * @param search The search text and the cursor to page from.
 * @returns The unexecuted relational query.
 */
export function queryAdminUsers(ctx: AppContext, search: AdminUsersSearch = {}) {
	const { q, cursor, dir } = search;
	const after = cursor ? decodeCursor(cursor, USER_CURSOR) : undefined;
	const order = scanOrder('desc', dir);

	return ctx.db.query.user.findMany({
		where: {
			RAW: (table) =>
				and(
					q ? matchesSearch('user', table.id, q) : undefined,
					after ? afterKey([table.createdAt, table.id], after, 'desc', dir) : undefined,
				) ?? sql`true`,
		},
		orderBy: (table, operators) => [
			operators[order](table.createdAt),
			operators[order](table.id),
		],
		limit: ctx.env.USER_LIST_PAGE_SIZE + 1,
	});
}

/**
 * @description Lists one page of users, newest first, optionally only those whose id, name or email
 * contains the search text. Requires `user:list`.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param search The search text and the cursor to page from.
 * @returns The page and the cursors on either side of it.
 */
export async function listAdminUsers(
	ctx: AppContext,
	caller: Caller,
	search: AdminUsersSearch = {},
): Promise<AdminUsersPage> {
	requirePermission(caller, { user: ['list'] });

	const rows = await queryAdminUsers(ctx, search);
	const page = toKeysetPage(rows, ctx.env.USER_LIST_PAGE_SIZE, search, (row) => [
		row.createdAt.getTime(),
		row.id,
	]);

	const items = page.items.map((row) => ({
		id: row.id,
		name: row.name,
		email: row.email,
		image: row.image ?? null,
		role: row.role ?? DEFAULT_ROLE,
		banned: row.banned ?? false,
		banReason: row.banReason ?? null,
		createdAt: row.createdAt,
	}));

	return { ...page, items };
}

/**
 * @description Looks up the user a staff filter names, e.g. the admin addons list's maintainer.
 * Requires `user:list`.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param id The user id.
 * @returns The user's id, name and image, or `undefined` when no user has the id.
 */
export async function getUserSummary(
	ctx: AppContext,
	caller: Caller,
	id: string,
): Promise<UserSummary | undefined> {
	requirePermission(caller, { user: ['list'] });

	const row = await ctx.db.query.user.findFirst({
		where: { id },
		columns: { id: true, name: true, image: true },
	});

	if (!row) return;

	return { id: row.id, name: row.name, image: row.image ?? null };
}

export default { queryAdminUsers, listAdminUsers, getUserSummary };
