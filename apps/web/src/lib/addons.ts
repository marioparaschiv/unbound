import type {
	AddonResponse,
	AddonSort,
	AddonType,
	AddonVersion,
	CatalogResponse,
	ListAddonsQuery,
	ListAddonsResponse,
	ListedAddon,
	Maintainer,
	MyAddonsResponse,
} from '@unbound-app/contracts/addons';
import { addonIdSchema, type PublishedManifest } from '@unbound-app/contracts/manifest';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { OPEN_SUBMISSION_STATUSES, toSubmission } from '~/lib/submissions';
import { afterKey, decodeCursor, toKeysetPage } from '~/lib/keyset';
import { MAINTAINERS, toMaintainers } from '~/lib/maintainers';
import type { AddonVersionRow } from '~/lib/artifacts';
import { appendEvent } from '~/lib/moderation-events';
import { requirePermission } from '~/lib/api/caller';
import { likeContains } from '~/lib/like-contains';
import { addon, addonVersion } from '~/db/schema';
import type { Transaction } from '~/db/database';
import { toAddonVersion } from '~/lib/artifacts';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import type { CursorKey } from '~/lib/keyset';
import { ApiError } from '~/lib/api/errors';

export type AddonRow = typeof addon.$inferSelect;

export type AddonSummary = Pick<AddonRow, 'type' | 'name' | 'description' | 'updatedAt'>;

export type AddonDetails = {
	id: string;
	type: AddonType;
	createdAt: string;
	/** Newest first, withdrawn ones left out; the first is served. */
	versions: AddonVersion[];
	maintainers: Maintainer[];
};

type ListedAddonRow = Pick<AddonRow, 'id' | 'type'> & { versions: AddonVersionRow[] };

type ManifestTypeFields = Pick<PublishedManifest, 'type' | 'main'>;

const SORT_COLUMNS = {
	name: 'name',
	created: 'createdAt',
	updated: 'updatedAt',
} as const satisfies Record<AddonSort, keyof AddonRow>;

const CURSOR_SCHEMAS = {
	name: z.tuple([z.string(), addonIdSchema]),
	created: z.tuple([z.int(), addonIdSchema]),
	updated: z.tuple([z.int(), addonIdSchema]),
} satisfies Record<AddonSort, z.ZodType<CursorKey>>;

/** Relational filter for the versions an addon can serve: the ones no rollback withdrew. */
export const LIVE_VERSIONS = { withdrawnBy: { isNull: true } } as const;

/** The relational `with` that loads the version an addon serves: its newest live version. */
export const LATEST_VERSION = {
	versions: { where: LIVE_VERSIONS, orderBy: { versionKey: 'desc' }, limit: 1 },
} as const;

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
 * @description Copies the summary of the version the addon serves onto the addon row, after a version
 * is approved or a rollback changes which one is served.
 * @param tx The approval or rollback transaction.
 * @param addonId The addon id.
 */
export function refreshAddonSummary(tx: Transaction, addonId: string) {
	const latest = tx
		.select({ manifest: addonVersion.manifest, publishedAt: addonVersion.publishedAt })
		.from(addonVersion)
		.where(and(eq(addonVersion.addonId, addonId), isNull(addonVersion.withdrawnBy)))
		.orderBy(desc(addonVersion.versionKey))
		.limit(1)
		.get();

	if (!latest) {
		throw new Error(`Addon ${addonId} has no live version to summarize.`);
	}

	tx.update(addon)
		.set(toAddonSummary(latest.manifest, latest.publishedAt))
		.where(eq(addon.id, addonId))
		.run();
}

// Moving to the state the addon is already in changes nothing and records nothing.
function setDelistedAt(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	delistedAt: Date | null,
): AddonResponse {
	requirePermission(caller, { addon: ['delist'] });

	const row = ctx.db.transaction(
		(tx) => {
			const current = tx.select().from(addon).where(eq(addon.id, addonId)).get();

			if (!current) {
				throw new ApiError('not_found', `Addon ${addonId} does not exist.`);
			}

			if ((current.delistedAt === null) === (delistedAt === null)) {
				return current;
			}

			appendEvent(tx, {
				subject: { type: 'addon', id: addonId },
				actorId: caller.user.id,
				at: ctx.now(),
				kind: delistedAt ? 'addon.delisted' : 'addon.relisted',
				data: {},
			});

			return tx
				.update(addon)
				.set({ delistedAt })
				.where(eq(addon.id, addonId))
				.returning()
				.get();
		},
		{ behavior: 'immediate' },
	);

	return { addon: toAddon(row) };
}

/**
 * @description Hides an addon from listings and update checks. Its published files stay in the
 * public bucket so existing installs keep working. Delisting a delisted addon changes nothing.
 * Requires `addon:delist`. Twin of {@link relistAddon}.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param addonId The addon id.
 * @returns The addon.
 */
export function delistAddon(ctx: AppContext, caller: Caller, addonId: string): AddonResponse {
	return setDelistedAt(ctx, caller, addonId, ctx.now());
}

/**
 * @description Lists a delisted addon again. Relisting a listed addon changes nothing. Requires
 * `addon:delist`. Twin of {@link delistAddon}.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param addonId The addon id.
 * @returns The addon.
 */
export function relistAddon(ctx: AppContext, caller: Caller, addonId: string): AddonResponse {
	return setDelistedAt(ctx, caller, addonId, null);
}

function listingKey(row: AddonRow, sort: AddonSort): CursorKey {
	const value = row[SORT_COLUMNS[sort]];

	return [value instanceof Date ? value.getTime() : value, row.id];
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
	const after = cursor ? decodeCursor(cursor, CURSOR_SCHEMAS[sort]) : undefined;

	return ctx.db.query.addon.findMany({
		where: {
			delistedAt: { isNull: true },
			type,
			RAW: (table) =>
				and(
					q
						? or(likeContains(table.name, q), likeContains(table.description, q))
						: undefined,
					after ? afterKey([table[column], table.id], after, order) : undefined,
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

// An addon row without an approved version has nothing to install, so it is not listed.
function toListedAddons(ctx: AppContext, rows: ListedAddonRow[]): ListedAddon[] {
	return rows.flatMap((row) => {
		const [latest] = row.versions;

		return latest
			? [{ id: row.id, type: row.type, latestVersion: toAddonVersion(ctx.env, latest) }]
			: [];
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
	const rows = await queryListedAddons(ctx, query);
	const page = toKeysetPage(rows, ctx.env.ADDON_LIST_PAGE_SIZE, query, (row) =>
		listingKey(row, query.sort ?? 'name'),
	);

	return { addons: toListedAddons(ctx, page.items), nextCursor: page.next };
}

/**
 * @description Snapshots every listed addon with its newest version, ordered by id. The revision is a
 * hash of the snapshot, so it changes exactly when an approval, delist or relist changes what is listed.
 * @param ctx The application context.
 * @returns The catalog and its revision.
 */
export async function getCatalog(ctx: AppContext): Promise<CatalogResponse> {
	const rows = await ctx.db.query.addon.findMany({
		where: { delistedAt: { isNull: true } },
		with: LATEST_VERSION,
		orderBy: { id: 'asc' },
	});
	const addons = toListedAddons(ctx, rows);
	const revision = new Bun.CryptoHasher('sha256').update(JSON.stringify(addons)).digest('hex');

	return { revision, addons };
}

/**
 * @description Loads a listed addon for its public page: every approved version no rollback withdrew,
 * newest first, and its maintainers, owners first.
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
		with: {
			versions: { where: LIVE_VERSIONS, orderBy: { versionKey: 'desc' } },
			maintainers: MAINTAINERS,
		},
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
	LIVE_VERSIONS,
	LATEST_VERSION,
	toAddon,
	getManifestType,
	toAddonSummary,
	refreshAddonSummary,
	delistAddon,
	relistAddon,
	queryListedAddons,
	listAddons,
	getCatalog,
	getAddonDetails,
	listMyAddons,
};
