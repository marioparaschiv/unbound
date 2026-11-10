import type { AdminAddonStatus, AdminAddonsSearch } from '@unbound-app/contracts/admin';
import type { SortOrder, AddonType, Addon } from '@unbound-app/contracts/addons';
import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { Type, type StaticDecode } from '@unbound-app/contracts/schema';
import type { UserSummary } from '@unbound-app/contracts/account';
import { addonIdSchema } from '@unbound-app/contracts/manifest';
import type { SQL } from 'drizzle-orm';

import { cursorTime, keysetList } from '~/lib/keyset';
import { addonMaintainer, addonSearchText, submission } from '~/db/schema';
import { SERVED_VERSION } from '~/lib/addon-visibility';
import { requirePermission } from '~/lib/api/caller';
import { renderAddonIcon } from '~/lib/addon-icons';
import { matchesSearch } from '~/lib/admin-search';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import type { KeysetPage } from '~/lib/keyset';
import type { Database } from '~/db/database';
import { DAY_MS } from '~/lib/calendar-date';
import type { addon } from '~/db/schema';
import { toAddon } from '~/lib/addons';

export type AdminAddon = Addon & {
	name: string;
	type: AddonType;
	/** The picked icon's SVG markup, rendered on the server; `null` for the type's default. */
	iconSvg: string | null;
	/** The version it serves: the newest one no rollback withdrew. */
	latestVersion: string | null;
	owners: UserSummary[];
};

export type AdminAddonsPage = KeysetPage<AdminAddon>;

type OpenUpdateStatus = Extract<AdminAddonStatus, 'pending_review' | 'changes_requested'>;

type StatusFilter = (db: Database, table: typeof addon) => SQL;

const ADDON_CURSOR = Type.Tuple([cursorTime, addonIdSchema]);

type AddonPosition = StaticDecode<typeof ADDON_CURSOR>;

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
		q ? matchesSearch(addonSearchText(table), q) : undefined,
		type ? eq(table.type, type) : undefined,
		status ? STATUS_FILTERS[status](db, table) : undefined,
		maintained ? inArray(table.id, maintained) : undefined,
	];
}

/**
 * @description Builds one page of {@link listAdminAddons} by `(created_at, id)`, each with its newest
 * version and owners.
 * @param ctx The application context.
 * @param search The filters, order and the cursor to page from.
 * @returns The page's statement and its reader.
 */
export function queryAdminAddons(ctx: AppContext, search: AdminAddonsSearch = {}) {
	return keysetList({
		key: ['createdAt', 'id'],
		schema: ADDON_CURSOR,
		request: search,
		order: search.order ?? 'desc',
		size: ctx.env.ADMIN_ADDON_LIST_PAGE_SIZE,
		query: (page) =>
			ctx.db.query.addon.findMany({
				where: {
					RAW: (table) =>
						and(
							...filters(ctx.db, table, search),
							...publishedRange(table, search, page.read, page.after),
							page.where(table),
						) ?? sql`true`,
				},
				with: {
					versions: { ...SERVED_VERSION, columns: { version: true } },
					maintainers: {
						where: { role: 'owner' },
						with: { user: { columns: { id: true, name: true, image: true } } },
						orderBy: { createdAt: 'asc', userId: 'asc' },
					},
				},
				orderBy: (table) => page.orderBy(table),
				limit: page.limit,
			}),
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

	const page = await queryAdminAddons(ctx, search).page();

	const items = page.items.map((row) => ({
		...toAddon(row),
		name: row.name,
		type: row.type,
		iconSvg: renderAddonIcon(row.icon),
		latestVersion: row.versions[0]?.version ?? null,
		owners: row.maintainers.flatMap(({ user }) =>
			user ? [{ id: user.id, name: user.name, image: user.image ?? null }] : [],
		),
	}));

	return { ...page, items };
}

export default { queryAdminAddons, listAdminAddons };
