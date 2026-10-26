import type { AdminAddonStatus, AdminAddonsSearch } from '@unbound-app/contracts/admin';
import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type { SortOrder, Addon } from '@unbound-app/contracts/addons';
import type { UserSummary } from '@unbound-app/contracts/account';
import { addonIdSchema } from '@unbound-app/contracts/manifest';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';

import { afterKey, cursorTime, decodeCursor, scanOrder, toKeysetPage } from '~/lib/keyset';
import { addonMaintainer, submission } from '~/db/schema';
import type { KeysetPage } from '~/lib/keyset';
import { LIVE_VERSIONS, toAddon } from '~/lib/addons';
import { requirePermission } from '~/lib/api/caller';
import { matchesSearch } from '~/lib/admin-search';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import type { Database } from '~/db/database';
import type { addon } from '~/db/schema';

export type AdminAddon = Addon & {
	name: string;
	/** The version it serves: the newest one no rollback withdrew. */
	latestVersion: string | null;
	owners: UserSummary[];
};

export type AdminAddonsPage = KeysetPage<AdminAddon>;

type OpenUpdateStatus = Extract<AdminAddonStatus, 'pending_review' | 'changes_requested'>;

type StatusFilter = (db: Database, table: typeof addon) => SQL;

const ADDON_CURSOR = z.tuple([cursorTime, addonIdSchema]);

type AddonPosition = z.output<typeof ADDON_CURSOR>;

const DAY_MS = 24 * 60 * 60 * 1000;

function withOpenUpdate(db: Database, table: typeof addon, status: OpenUpdateStatus): SQL {
	const open = db
		.select({ id: submission.addonId })
		.from(submission)
		.where(and(eq(submission.status, status), eq(submission.kind, 'update')));

	return inArray(table.id, open);
}

const STATUS_FILTERS = {
	listed: (_db, table) => isNull(table.delistedAt),
	delisted: (_db, table) => isNotNull(table.delistedAt),
	pending_review: (db, table) => withOpenUpdate(db, table, 'pending_review'),
	changes_requested: (db, table) => withOpenUpdate(db, table, 'changes_requested'),
} satisfies Record<AdminAddonStatus, StatusFilter>;

function startOfDay(date: string): Date {
	return new Date(`${date}T00:00:00.000Z`);
}

// An index range seeks on one bound per side, so a cursor that already lies inside the range replaces
// the published bound on its side instead of being filtered row by row behind it.
function publishedRange(
	table: typeof addon,
	search: AdminAddonsSearch,
	read: SortOrder,
	after: AddonPosition | undefined,
) {
	const from = search.publishedFrom ? startOfDay(search.publishedFrom).getTime() : undefined;
	const until = search.publishedTo
		? startOfDay(search.publishedTo).getTime() + DAY_MS
		: undefined;
	const position = after?.[0].getTime();
	const lowerByCursor = read === 'asc' && position !== undefined && from !== undefined;
	const upperByCursor = read === 'desc' && position !== undefined && until !== undefined;
	const lower = lowerByCursor && position >= from ? undefined : from;
	const upper = upperByCursor && position < until ? undefined : until;

	return [
		lower === undefined ? undefined : gte(table.createdAt, new Date(lower)),
		upper === undefined ? undefined : lt(table.createdAt, new Date(upper)),
	];
}

function filters(db: Database, table: typeof addon, search: AdminAddonsSearch) {
	const { q, type, status, maintainer } = search;
	const maintained = maintainer
		? db
				.select({ id: addonMaintainer.addonId })
				.from(addonMaintainer)
				.where(eq(addonMaintainer.userId, maintainer))
		: undefined;

	return [
		q ? matchesSearch('addon', table.id, q) : undefined,
		type ? eq(table.type, type) : undefined,
		status ? STATUS_FILTERS[status](db, table) : undefined,
		maintained ? inArray(table.id, maintained) : undefined,
	];
}

/**
 * @description Builds the one statement behind {@link listAdminAddons}: one page plus a lookahead row
 * by `(created_at, id)`, each with its newest version and owners.
 * @param ctx The application context.
 * @param search The filters, order and the cursor to page from.
 * @returns The unexecuted relational query.
 */
export function queryAdminAddons(ctx: AppContext, search: AdminAddonsSearch = {}) {
	const { order = 'desc', cursor, dir } = search;
	const after = cursor ? decodeCursor(cursor, ADDON_CURSOR) : undefined;
	const read = scanOrder(order, dir);

	return ctx.db.query.addon.findMany({
		where: {
			RAW: (table) =>
				and(
					...filters(ctx.db, table, search),
					...publishedRange(table, search, read, after),
					after ? afterKey([table.createdAt, table.id], after, order, dir) : undefined,
				) ?? sql`true`,
		},
		with: {
			versions: {
				columns: { version: true },
				where: LIVE_VERSIONS,
				orderBy: { versionKey: 'desc' },
				limit: 1,
			},
			maintainers: {
				where: { role: 'owner' },
				with: { user: { columns: { id: true, name: true, image: true } } },
				orderBy: { createdAt: 'asc' },
			},
		},
		orderBy: (table, operators) => [
			operators[read](table.createdAt),
			operators[read](table.id),
		],
		limit: ctx.env.ADDON_LIST_PAGE_SIZE + 1,
	});
}

/**
 * @description Lists one page of every addon, delisted ones included, by first approval (newest first
 * unless `order` is `asc`), narrowed by every filter given, with each one's newest version and owners.
 * Requires `addon:delist`.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param search The filters, order and the cursor to page from.
 * @returns The page and the cursors on either side of it.
 */
export async function listAdminAddons(
	ctx: AppContext,
	caller: Caller,
	search: AdminAddonsSearch = {},
): Promise<AdminAddonsPage> {
	requirePermission(caller, { addon: ['delist'] });

	const rows = await queryAdminAddons(ctx, search);
	const page = toKeysetPage(rows, ctx.env.ADDON_LIST_PAGE_SIZE, search, (row) => [
		row.createdAt.getTime(),
		row.id,
	]);

	const items = page.items.map((row) => ({
		...toAddon(row),
		name: row.name,
		latestVersion: row.versions[0]?.version ?? null,
		owners: row.maintainers.flatMap(({ user }) =>
			user ? [{ id: user.id, name: user.name, image: user.image ?? null }] : [],
		),
	}));

	return { ...page, items };
}

export default { queryAdminAddons, listAdminAddons };
