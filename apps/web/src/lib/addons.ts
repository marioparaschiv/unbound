import type {
	AddonResponse,
	AddonSort,
	AddonType,
	AddonVersion,
	ListAddonsQuery,
	ListAddonsResponse,
	Maintainer,
	MaintainersResponse,
	MyAddonsResponse,
	TransferAddonRequest,
} from '@unbound-app/contracts/addons';
import { addonIdSchema, type PublishedManifest } from '@unbound-app/contracts/manifest';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { OPEN_SUBMISSION_STATUSES, toSubmission } from '~/lib/submissions';
import { addon, addonMaintainer, addonVersion } from '~/db/schema';
import { requirePermission } from '~/lib/api/caller';
import { likeContains } from '~/lib/like-contains';
import type { Transaction } from '~/db/database';
import { toAddonVersion } from '~/lib/artifacts';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';

export type AddonRow = typeof addon.$inferSelect;

export type AddonSummary = Pick<AddonRow, 'type' | 'name' | 'description' | 'updatedAt'>;

export type AddonDetails = {
	id: string;
	type: AddonType;
	createdAt: string;
	/** Newest first. */
	versions: AddonVersion[];
	maintainers: Maintainer[];
};

type MaintainerRow = Pick<typeof addonMaintainer.$inferSelect, 'role' | 'createdAt'> & {
	user: Pick<Maintainer, 'id' | 'name' | 'image'> | null;
};

type ListingCursor = [value: string | number, id: string];

type ManifestTypeFields = Pick<PublishedManifest, 'type' | 'main'>;

const MAINTAINERS = {
	with: { user: { columns: { id: true, name: true, image: true } } },
	orderBy: { role: 'desc', createdAt: 'asc' },
} as const;

const SORT_COLUMNS = {
	name: 'name',
	created: 'createdAt',
	updated: 'updatedAt',
} as const satisfies Record<AddonSort, keyof AddonRow>;

const CURSOR_SCHEMAS = {
	name: z.tuple([z.string(), addonIdSchema]),
	created: z.tuple([z.int(), addonIdSchema]),
	updated: z.tuple([z.int(), addonIdSchema]),
} satisfies Record<AddonSort, z.ZodType<ListingCursor>>;

/** The relational `with` that loads an addon's newest version. */
export const LATEST_VERSION = { versions: { orderBy: { versionKey: 'desc' }, limit: 1 } } as const;

/**
 * @description Serializes an addon row for the API.
 * @param row The addon row.
 * @returns The addon.
 */
export function toAddon(row: AddonRow): AddonResponse['addon'] {
	return {
		id: row.id,
		createdAt: row.createdAt.toISOString(),
		delistedAt: row.delistedAt?.toISOString() ?? null,
	};
}

function toMaintainers(rows: MaintainerRow[]): Maintainer[] {
	return rows.flatMap((row) =>
		row.user
			? [
					{
						id: row.user.id,
						name: row.user.name,
						image: row.user.image ?? null,
						role: row.role,
						addedAt: row.createdAt.toISOString(),
					},
				]
			: [],
	);
}

/**
 * @description Reads an addon's type from its manifest.
 * @param manifest The manifest's `type` and `main`.
 * @returns The declared type, or the type implied by `main`.
 */
export function getManifestType({ type, main }: ManifestTypeFields): AddonType {
	return type ?? (main.endsWith('.json') ? 'theme' : 'plugin');
}

/**
 * @description Derives the listing columns an addon copies from its newest version.
 * @param manifest The newest version's manifest.
 * @param publishedAt When that version was approved.
 * @returns The `addon` summary columns.
 */
export function toAddonSummary(manifest: PublishedManifest, publishedAt: Date): AddonSummary {
	return {
		type: getManifestType(manifest),
		name: manifest.name,
		description: manifest.description,
		updatedAt: publishedAt,
	};
}

/**
 * @description Copies the addon's newest version's summary onto the addon row, after a version is
 * approved.
 * @param tx The approval transaction.
 * @param addonId The addon id.
 */
export function refreshAddonSummary(tx: Transaction, addonId: string) {
	const latest = tx
		.select({ manifest: addonVersion.manifest, publishedAt: addonVersion.publishedAt })
		.from(addonVersion)
		.where(eq(addonVersion.addonId, addonId))
		.orderBy(desc(addonVersion.versionKey))
		.limit(1)
		.get();

	if (!latest) {
		throw new Error(`Addon ${addonId} has no approved version to summarize.`);
	}

	tx.update(addon)
		.set(toAddonSummary(latest.manifest, latest.publishedAt))
		.where(eq(addon.id, addonId))
		.run();
}

async function requireAddon(ctx: AppContext, id: string) {
	const row = await ctx.db.query.addon.findFirst({ where: { id }, columns: { id: true } });

	if (!row) {
		throw new ApiError('not_found', `Addon ${id} does not exist.`);
	}
}

async function requireUser(ctx: AppContext, userId: string) {
	const target = await ctx.db.query.user.findFirst({
		where: { id: userId },
		columns: { id: true },
	});

	if (!target) {
		throw new ApiError('not_found', `User ${userId} does not exist.`);
	}
}

async function requireOwner(ctx: AppContext, caller: Caller, addonId: string) {
	const membership = await ctx.db.query.addonMaintainer.findFirst({
		where: { addonId, userId: caller.user.id },
		columns: { role: true },
	});

	if (!membership) {
		await requireAddon(ctx, addonId);

		throw new ApiError('not_maintainer', `You are not a maintainer of ${addonId}.`);
	}

	if (membership.role !== 'owner') {
		throw new ApiError('forbidden', `Only owners of ${addonId} can manage its maintainers.`);
	}
}

/**
 * @description Lists the addon's maintainers, owners first.
 * @param ctx The application context.
 * @param addonId The addon id.
 * @returns The maintainers.
 */
export async function listMaintainers(
	ctx: AppContext,
	addonId: string,
): Promise<MaintainersResponse> {
	const rows = await ctx.db.query.addonMaintainer.findMany({
		where: { addonId },
		...MAINTAINERS,
	});

	return { maintainers: toMaintainers(rows) };
}

/**
 * @description Adds a user as a maintainer of an addon the caller owns. Adding an existing member
 * changes nothing.
 * @param ctx The application context.
 * @param caller An owner of the addon.
 * @param addonId The addon id.
 * @param userId The user to add.
 * @returns The maintainers after the change.
 */
export async function addMaintainer(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	userId: string,
): Promise<MaintainersResponse> {
	await requireOwner(ctx, caller, addonId);
	await requireUser(ctx, userId);

	await ctx.db
		.insert(addonMaintainer)
		.values({ addonId, userId, role: 'maintainer', createdAt: ctx.now() })
		.onConflictDoNothing();

	return listMaintainers(ctx, addonId);
}

/**
 * @description Removes a maintainer from an addon the caller owns. An owner can only be removed while
 * another owner remains.
 * @param ctx The application context.
 * @param caller An owner of the addon.
 * @param addonId The addon id.
 * @param userId The member to remove.
 * @returns The maintainers after the change.
 */
export async function removeMaintainer(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	userId: string,
): Promise<MaintainersResponse> {
	await requireOwner(ctx, caller, addonId);

	ctx.db.transaction(
		(tx) => {
			const members = tx
				.select({ userId: addonMaintainer.userId, role: addonMaintainer.role })
				.from(addonMaintainer)
				.where(eq(addonMaintainer.addonId, addonId))
				.all();

			const target = members.find((member) => member.userId === userId);

			if (!target) {
				throw new ApiError('not_found', `${userId} is not a maintainer of ${addonId}.`);
			}

			const owners = members.filter((member) => member.role === 'owner');

			if (target.role === 'owner' && owners.length <= 1) {
				throw new ApiError(
					'last_owner',
					`${addonId} needs another owner before its only owner can leave.`,
				);
			}

			tx.delete(addonMaintainer)
				.where(
					and(eq(addonMaintainer.addonId, addonId), eq(addonMaintainer.userId, userId)),
				)
				.run();
		},
		{ behavior: 'immediate' },
	);

	return listMaintainers(ctx, addonId);
}

/**
 * @description Makes another user the addon's owner. The previous owner stays on as a maintainer
 * unless `keepPreviousOwner` is false. Requires `addon:transfer`.
 * @param ctx The application context.
 * @param caller The administrator.
 * @param addonId The addon id.
 * @param request The new owner and whether to keep the previous one.
 * @returns The maintainers after the transfer.
 */
export async function transferAddon(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	request: TransferAddonRequest,
): Promise<MaintainersResponse> {
	requirePermission(caller, { addon: ['transfer'] });

	await requireAddon(ctx, addonId);
	await requireUser(ctx, request.userId);

	const previous = and(
		eq(addonMaintainer.addonId, addonId),
		eq(addonMaintainer.role, 'owner'),
		ne(addonMaintainer.userId, request.userId),
	);

	ctx.db.transaction(
		(tx) => {
			if (request.keepPreviousOwner) {
				tx.update(addonMaintainer).set({ role: 'maintainer' }).where(previous).run();
			} else {
				tx.delete(addonMaintainer).where(previous).run();
			}

			tx.insert(addonMaintainer)
				.values({ addonId, userId: request.userId, role: 'owner', createdAt: ctx.now() })
				.onConflictDoUpdate({
					target: [addonMaintainer.addonId, addonMaintainer.userId],
					set: { role: 'owner' },
				})
				.run();
		},
		{ behavior: 'immediate' },
	);

	return listMaintainers(ctx, addonId);
}

async function setDelistedAt(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	delistedAt: Date | null,
): Promise<AddonResponse> {
	requirePermission(caller, { addon: ['delist'] });

	const [updated] = await ctx.db
		.update(addon)
		.set({ delistedAt })
		.where(eq(addon.id, addonId))
		.returning();

	if (!updated) {
		throw new ApiError('not_found', `Addon ${addonId} does not exist.`);
	}

	return { addon: toAddon(updated) };
}

/**
 * @description Hides an addon from listings and update checks. Its published files stay in the
 * public bucket so existing installs keep working. Requires `addon:delist`. Twin of {@link relistAddon}.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param addonId The addon id.
 * @returns The addon.
 */
export function delistAddon(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
): Promise<AddonResponse> {
	return setDelistedAt(ctx, caller, addonId, ctx.now());
}

/**
 * @description Lists a delisted addon again. Requires `addon:delist`. Twin of {@link delistAddon}.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param addonId The addon id.
 * @returns The addon.
 */
export function relistAddon(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
): Promise<AddonResponse> {
	return setDelistedAt(ctx, caller, addonId, null);
}

function encodeCursor(row: AddonRow, sort: AddonSort): string {
	const value = row[SORT_COLUMNS[sort]];
	const cursor: ListingCursor = [value instanceof Date ? value.getTime() : value, row.id];

	return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(cursor: string, sort: AddonSort): ListingCursor {
	try {
		return CURSOR_SCHEMAS[sort].parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
	} catch {
		throw new ApiError('invalid_request', `The cursor is not a ${sort} listing cursor.`);
	}
}

/**
 * @description Builds the one statement behind {@link listAddons}: one page plus a lookahead row,
 * keyset-paginated over the sort column and id so every filter and sort reads one index.
 * @param ctx The application context.
 * @param query The type filter, search text, sort and the previous page's cursor.
 * @returns The unexecuted relational query.
 */
export function queryListedAddons(ctx: AppContext, query: ListAddonsQuery = {}) {
	const { type, q, sort = 'name', order = 'asc', cursor } = query;
	const column = SORT_COLUMNS[sort];
	const after = cursor ? decodeCursor(cursor, sort) : undefined;

	return ctx.db.query.addon.findMany({
		where: {
			delistedAt: { isNull: true },
			type,
			RAW: (table) =>
				and(
					q
						? or(likeContains(table.name, q), likeContains(table.description, q))
						: undefined,
					after
						? sql`(${table[column]}, ${table.id}) ${order === 'asc' ? sql`>` : sql`<`} (${after[0]}, ${after[1]})`
						: undefined,
				) ?? sql`true`,
		},
		with: LATEST_VERSION,
		orderBy: (table, operators) => {
			const direction = operators[order];

			return [direction(table[column]), direction(table.id)];
		},
		limit: ctx.env.ADDON_LIST_PAGE_SIZE + 1,
	});
}

/**
 * @description Lists one page of approved addons that are not delisted, each with its newest version.
 * @param ctx The application context.
 * @param query The type filter, search text, sort and the previous page's cursor.
 * @returns The page and the cursor of the next one.
 */
export async function listAddons(
	ctx: AppContext,
	query: ListAddonsQuery = {},
): Promise<ListAddonsResponse> {
	const size = ctx.env.ADDON_LIST_PAGE_SIZE;
	const rows = await queryListedAddons(ctx, query);
	const page = rows.slice(0, size);
	const last = page.at(-1);
	const addons = page.flatMap((row) => {
		const [latest] = row.versions;

		return latest
			? [{ id: row.id, type: row.type, latestVersion: toAddonVersion(ctx.env, latest) }]
			: [];
	});

	return {
		addons,
		nextCursor: rows.length > size && last ? encodeCursor(last, query.sort ?? 'name') : null,
	};
}

/**
 * @description Loads a listed addon for its public page: every approved version, newest first, and
 * its maintainers, owners first.
 * @param ctx The application context.
 * @param id The addon id.
 * @returns The addon, or `undefined` when it does not exist or is delisted.
 */
export async function getAddonDetails(
	ctx: AppContext,
	id: string,
): Promise<AddonDetails | undefined> {
	const row = await ctx.db.query.addon.findFirst({
		where: { id, delistedAt: { isNull: true } },
		with: { versions: { orderBy: { versionKey: 'desc' } }, maintainers: MAINTAINERS },
	});

	if (!row) return;

	return {
		id: row.id,
		type: row.type,
		createdAt: row.createdAt.toISOString(),
		versions: row.versions.map((version) => toAddonVersion(ctx.env, version)),
		maintainers: toMaintainers(row.maintainers),
	};
}

/**
 * @description Lists the addons the caller maintains with their newest version and open submissions,
 * plus the caller's new listings still in the queue.
 * @param ctx The application context.
 * @param caller The signed-in user.
 * @returns The caller's addons and open listings.
 */
export async function listMyAddons(ctx: AppContext, caller: Caller): Promise<MyAddonsResponse> {
	const userId = caller.user.id;
	const memberships = await ctx.db.query.addonMaintainer.findMany({
		where: { userId },
		with: { addon: { with: LATEST_VERSION } },
		orderBy: { addonId: 'asc' },
	});

	const ids = memberships.map((membership) => membership.addonId);
	const open = await ctx.db.query.submission.findMany({
		where: {
			status: { in: OPEN_SUBMISSION_STATUSES },
			OR: [{ addonId: { in: ids } }, { authorId: userId, kind: 'listing' }],
		},
		orderBy: { createdAt: 'asc' },
	});

	const addons = memberships.flatMap(({ addon: row, role }) => {
		if (!row) {
			return [];
		}

		const [latest] = row.versions;

		return [
			{
				...toAddon(row),
				role,
				latestVersion: latest ? toAddonVersion(ctx.env, latest) : null,
				openSubmissions: open
					.filter((entry) => entry.addonId === row.id && entry.kind === 'update')
					.map(toSubmission),
			},
		];
	});

	const openListings = open.filter((entry) => entry.kind === 'listing').map(toSubmission);

	return { addons, openListings };
}

export default {
	LATEST_VERSION,
	toAddon,
	getManifestType,
	toAddonSummary,
	refreshAddonSummary,
	listMaintainers,
	addMaintainer,
	removeMaintainer,
	transferAddon,
	delistAddon,
	relistAddon,
	queryListedAddons,
	listAddons,
	getAddonDetails,
	listMyAddons,
};
