import { and, asc, count, eq, inArray, isNull, or } from 'drizzle-orm';
import type { PublicBadge } from '@unbound-app/contracts/sponsors';
import type { Caller } from '@unbound-app/contracts/account';

import { addon, addonMaintainer, user } from '~/db/schema';
import { getVisibleBadges } from '~/lib/sponsors/badges';
import { likeContains } from '~/lib/like-contains';
import { DEFAULT_ROLE } from '~/lib/auth/access';
import type { AppContext } from '~/lib/context';

export type DevelopersQuery = {
	/** Matches anywhere in the developer's name, case-insensitively. */
	search: string;
	/** 1-based. */
	page: number;
};

export type Developer = Caller & {
	badge: PublicBadge | null;
};

export type DevelopersPage = {
	developers: Developer[];
	total: number;
	pageSize: number;
};

/**
 * @description Lists one page of developers: users who are not banned and maintain at least one
 * listed addon, ordered by name.
 * @param ctx The application context.
 * @param query The name filter and page number.
 * @returns The page, the total number of matching developers and the page size.
 */
export async function listDevelopers(
	ctx: AppContext,
	query: DevelopersQuery,
): Promise<DevelopersPage> {
	const pageSize = ctx.env.DEVELOPER_LIST_PAGE_SIZE;
	const maintainers = ctx.db
		.select({ userId: addonMaintainer.userId })
		.from(addonMaintainer)
		.innerJoin(addon, eq(addon.id, addonMaintainer.addonId))
		.where(isNull(addon.delistedAt));

	const where = and(
		inArray(user.id, maintainers),
		or(isNull(user.banned), eq(user.banned, false)),
		query.search ? likeContains(user.name, query.search) : undefined,
	);

	const [rows, [counted]] = await Promise.all([
		ctx.db
			.select({ id: user.id, name: user.name, image: user.image, role: user.role })
			.from(user)
			.where(where)
			.orderBy(asc(user.name), asc(user.id))
			.limit(pageSize)
			.offset((query.page - 1) * pageSize),
		ctx.db.select({ total: count() }).from(user).where(where),
	]);

	const badges = await getVisibleBadges(
		ctx,
		rows.map((row) => row.id),
	);

	return {
		developers: rows.map((row) => ({
			...row,
			role: row.role ?? DEFAULT_ROLE,
			badge: badges.get(row.id) ?? null,
		})),
		total: counted?.total ?? 0,
		pageSize,
	};
}

export default { listDevelopers };
