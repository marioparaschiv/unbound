import type { AdminAddonsSearch } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { addonIdSchema } from '@unbound-app/contracts/manifest';
import type { Addon } from '@unbound-app/contracts/addons';
import { and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { afterKey, decodeCursor, scanOrder, toKeysetPage } from '~/lib/keyset';
import { requirePermission } from '~/lib/api/caller';
import { matchesSearch } from '~/lib/admin-search';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import type { KeysetPage } from '~/lib/keyset';
import { toAddon } from '~/lib/addons';

export type AdminAddon = Addon & {
	name: string;
	/** The newest approved version. */
	latestVersion: string | null;
	owners: UserSummary[];
};

export type AdminAddonsPage = KeysetPage<AdminAddon>;

const ADDON_CURSOR = z.tuple([z.int(), addonIdSchema]);

/**
 * @description Builds the one statement behind {@link listAdminAddons}: one page plus a lookahead row
 * by `(created_at, id)`, each with its newest version and owners.
 * @param ctx The application context.
 * @param search The search text, order and the cursor to page from.
 * @returns The unexecuted relational query.
 */
export function queryAdminAddons(ctx: AppContext, search: AdminAddonsSearch = {}) {
	const { q, order = 'desc', cursor, dir } = search;
	const after = cursor ? decodeCursor(cursor, ADDON_CURSOR) : undefined;
	const read = scanOrder(order, dir);

	return ctx.db.query.addon.findMany({
		where: {
			RAW: (table) =>
				and(
					q ? matchesSearch('addon', table.id, q) : undefined,
					after ? afterKey([table.createdAt, table.id], after, order, dir) : undefined,
				) ?? sql`true`,
		},
		with: {
			versions: { columns: { version: true }, orderBy: { versionKey: 'desc' }, limit: 1 },
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
 * unless `order` is `asc`), optionally only those whose id or name contains the search text, with each
 * one's newest version and owners. Requires `addon:delist`.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param search The search text, order and the cursor to page from.
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
