import type { AddonType, MaintainerRole } from '@unbound-app/contracts/addons';
import type { AdminUsersSearch } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { afterKey, cursorTime, decodeCursor, scanOrder, toKeysetPage } from '~/lib/keyset';
import { listSubmissionHistory } from '~/lib/admin-submissions';
import { DEFAULT_ROLE, hasPermission } from '~/lib/auth/access';
import type { AdminSubmission } from '~/lib/admin-submissions';
import type { EventTimeline } from '~/lib/moderation-events';
import { getEventTimeline } from '~/lib/moderation-events';
import { requirePermission } from '~/lib/api/caller';
import { LIVE_VERSIONS } from '~/lib/live-versions';
import { matchesSearch } from '~/lib/admin-search';
import type { StaffNote } from '~/lib/staff-notes';
import { listStaffNotes } from '~/lib/staff-notes';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import type { KeysetPage } from '~/lib/keyset';
import { userSearchText } from '~/db/schema';
import type { user } from '~/db/schema';

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

export type AdminUserRecord = AdminUser & {
	/** When a temporary ban lifts; `null` for a permanent ban or none. */
	banExpires: Date | null;
};

/** An addon the user owns or maintains. */
export type MaintainedAddon = {
	id: string;
	name: string;
	type: AddonType;
	role: MaintainerRole;
	delistedAt: Date | null;
	/** The newest approved version. */
	latestVersion: string | null;
};

export type AdminUserView = {
	user: AdminUserRecord;
	/** Owned addons first, then in the order they joined. */
	addons: MaintainedAddon[];
	/** Every submission they made, newest first. */
	submissions: AdminSubmission[];
	/** The newest page of the moderation events about them. */
	events: EventTimeline;
	/** Staff notes on them, newest first; empty without `note:read`. */
	notes: StaffNote[];
};

type UserRow = typeof user.$inferSelect;

const USER_CURSOR = z.tuple([cursorTime, z.string().min(1)]);

function toAdminUser(row: UserRow): AdminUser {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		image: row.image ?? null,
		role: row.role ?? DEFAULT_ROLE,
		banned: row.banned ?? false,
		banReason: row.banReason ?? null,
		createdAt: row.createdAt,
	};
}

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
					q ? matchesSearch(userSearchText(table), q) : undefined,
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

	return { ...page, items: page.items.map(toAdminUser) };
}

function queryMaintainedAddons(ctx: AppContext, userId: string) {
	return ctx.db.query.addonMaintainer.findMany({
		where: { userId },
		columns: { role: true },
		with: {
			addon: {
				columns: { id: true, name: true, type: true, delistedAt: true },
				with: {
					versions: {
						columns: { version: true },
						where: LIVE_VERSIONS,
						orderBy: { versionKey: 'desc' },
						limit: 1,
					},
				},
			},
		},
		orderBy: { role: 'desc', createdAt: 'asc', addonId: 'asc' },
	});
}

/**
 * @description Loads everything the admin user page shows: the profile, role and ban state, the
 * addons they maintain, their submissions and the moderation events about them. Requires `user:get`.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param id The user id.
 * @returns The view, or `undefined` when no user has the id.
 */
export async function getAdminUser(
	ctx: AppContext,
	caller: Caller,
	id: string,
): Promise<AdminUserView | undefined> {
	requirePermission(caller, { user: ['get'] });

	const [row, maintained, submissions, events, notes] = await Promise.all([
		ctx.db.query.user.findFirst({ where: { id } }),
		queryMaintainedAddons(ctx, id),
		listSubmissionHistory(ctx, { authorId: id }),
		getEventTimeline(ctx, caller, { type: 'user', id }),
		hasPermission(caller.user.role, { note: ['read'] })
			? listStaffNotes(ctx, caller, { type: 'user', id })
			: [],
	]);

	if (!row) return;

	return {
		user: { ...toAdminUser(row), banExpires: row.banExpires ?? null },
		addons: maintained.flatMap(({ role, addon }) =>
			addon
				? [
						{
							id: addon.id,
							name: addon.name,
							type: addon.type,
							role,
							delistedAt: addon.delistedAt,
							latestVersion: addon.versions[0]?.version ?? null,
						},
					]
				: [],
		),
		submissions,
		events,
		notes,
	};
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

export default { queryAdminUsers, listAdminUsers, getAdminUser, getUserSummary };
