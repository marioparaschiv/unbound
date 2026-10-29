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
import { and, desc, EmptyFilter, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { addonIdSchema, type PublishedManifest } from '@unbound-app/contracts/manifest';
import type { RepositoryDetails } from '@unbound-app/contracts/source';
import type { PinnableField } from '@unbound-app/contracts/admin';
import { z } from 'zod';

import { OPEN_SUBMISSION_STATUSES, requireSourced, toSubmission } from '~/lib/submissions';
import { afterKey, cursorTime, decodeCursor, toKeysetPage } from '~/lib/keyset';
import type { AddonVersionRow, VersionSubmission } from '~/lib/artifacts';
import { VERSION_SOURCE, toAddonVersion } from '~/lib/artifacts';
import { MAINTAINERS, toMaintainers } from '~/lib/maintainers';
import type { CursorKey, CursorPosition } from '~/lib/keyset';
import { addon, addonTag, addonVersion } from '~/db/schema';
import type { ActionMeta } from '~/lib/moderation-events';
import { appendEvent } from '~/lib/moderation-events';
import { requirePermission } from '~/lib/api/caller';
import { LIVE_VERSIONS } from '~/lib/live-versions';
import { likeContains } from '~/lib/like-contains';
import type { Transaction } from '~/db/database';
import { splitList } from '~/lib/addon-filters';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';
import one from '~/db/one';

export type AddonRow = typeof addon.$inferSelect;

export type AddonSummary = Pick<AddonRow, 'type' | 'name' | 'description' | 'updatedAt'>;

export type AddonDetails = {
	id: string;
	type: AddonType;
	name: string;
	description: string;
	icon: string | null;
	createdAt: string;
	/** Newest first, withdrawn ones left out; the first is served. */
	versions: AddonVersion[];
	maintainers: Maintainer[];
	/** The newest version's ADDON.md, or `null` when it has none or predates GitHub sources. */
	addonMd: string | null;
	/** The newest version's GitHub details, or `null` when it predates GitHub sources. */
	details: RepositoryDetails | null;
};

type SourcedVersionRow = AddonVersionRow & { submission: VersionSubmission | null };

type ListedAddonRow = Pick<AddonRow, 'id' | 'type' | 'name' | 'description' | 'icon'> & {
	versions: SourcedVersionRow[];
};

type PinnableColumn = (typeof addon)[PinnableField];

type ManifestTypeFields = Pick<PublishedManifest, 'type' | 'main'>;

type ListingTable = Pick<typeof addon, 'id' | 'updatedAt'>;

type ListingFilters = NonNullable<ListAddonsQuery>;

const DAY_MS = 24 * 60 * 60 * 1000;

const SORT_COLUMNS = {
	name: 'name',
	created: 'createdAt',
	updated: 'updatedAt',
} as const satisfies Record<AddonSort, keyof AddonRow>;

const CURSOR_SCHEMAS = {
	name: z.tuple([z.string(), addonIdSchema]),
	created: z.tuple([cursorTime, addonIdSchema]),
	updated: z.tuple([cursorTime, addonIdSchema]),
} satisfies Record<AddonSort, z.ZodType<CursorPosition>>;

/** The `addon.pinned_fields` bit of each summary field a staff edit can own. */
export const PINNED_FIELDS = {
	name: 1 << 0,
	description: 1 << 1,
	type: 1 << 2,
} as const satisfies Record<PinnableField, number>;

/** The relational `with` that loads the version an addon serves: its newest live version. */
export const LATEST_VERSION = {
	versions: {
		where: LIVE_VERSIONS,
		orderBy: { versionKey: 'desc' },
		limit: 1,
		with: VERSION_SOURCE,
	},
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

function unlessPinned(field: PinnableField, column: PinnableColumn, value: string) {
	return sql`case when (${addon.pinnedFields} & ${PINNED_FIELDS[field]}::integer) <> 0 then ${column} else ${value} end`;
}

/**
 * @description Copies the summary of the version the addon serves onto the addon row, except the
 * fields staff pinned.
 * @param tx The approval, rollback or edit transaction.
 * @param addonId The addon id.
 * @returns Resolves once the summary is copied.
 */
export async function refreshAddonSummary(tx: Transaction, addonId: string): Promise<void> {
	const [latest] = await tx
		.select({ manifest: addonVersion.manifest, publishedAt: addonVersion.publishedAt })
		.from(addonVersion)
		.where(and(eq(addonVersion.addonId, addonId), isNull(addonVersion.withdrawnBy)))
		.orderBy(desc(addonVersion.versionKey))
		.limit(1);

	if (!latest) {
		throw new Error(`Addon ${addonId} has no live version to summarize.`);
	}

	const summary = toAddonSummary(latest.manifest, latest.publishedAt);

	await tx
		.update(addon)
		.set({
			type: unlessPinned('type', addon.type, summary.type),
			name: unlessPinned('name', addon.name, summary.name),
			description: unlessPinned('description', addon.description, summary.description),
			updatedAt: summary.updatedAt,
		})
		.where(eq(addon.id, addonId));
}

/**
 * @description The one writer of an addon's delisted state, inside the caller's transaction. Moving to
 * the state the addon is already in changes nothing and records nothing.
 * @param tx The action's transaction.
 * @param current The addon row as the transaction read it.
 * @param delisted Whether the addon should be delisted.
 * @param meta Who made the change, when and why.
 * @returns The addon row after the change.
 */
export async function writeDelisted(
	tx: Transaction,
	current: AddonRow,
	delisted: boolean,
	meta: ActionMeta,
): Promise<AddonRow> {
	if ((current.delistedAt !== null) === delisted) {
		return current;
	}

	await appendEvent(tx, {
		...meta,
		subject: { type: 'addon', id: current.id },
		kind: delisted ? 'addon.delisted' : 'addon.relisted',
		data: {},
	});

	return one(
		await tx
			.update(addon)
			.set({ delistedAt: delisted ? meta.at : null })
			.where(eq(addon.id, current.id))
			.returning(),
	);
}

async function setDelisted(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	delisted: boolean,
): Promise<AddonResponse> {
	requirePermission(caller, { addon: ['delist'] });

	const at = ctx.now();
	const row = await ctx.db.transaction(async (tx) => {
		const [current] = await tx.select().from(addon).where(eq(addon.id, addonId));

		if (!current) {
			throw new ApiError('not_found', `Addon ${addonId} does not exist.`);
		}

		return writeDelisted(tx, current, delisted, { actorId: caller.user.id, at });
	});

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
export function delistAddon(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
): Promise<AddonResponse> {
	return setDelisted(ctx, caller, addonId, true);
}

/**
 * @description Lists a delisted addon again. Relisting a listed addon changes nothing. Requires
 * `addon:delist`. Twin of {@link delistAddon}.
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
	return setDelisted(ctx, caller, addonId, false);
}

function listingKey(row: AddonRow, sort: AddonSort): CursorKey {
	const value = row[SORT_COLUMNS[sort]];

	return [value instanceof Date ? value.getTime() : value, row.id];
}

function tagFilter(table: ListingTable, query: ListingFilters) {
	const tags = splitList(query.tags);

	if (tags.length === 0) return;

	const tagged = sql`from ${addonTag} where ${addonTag.addonId} = ${table.id} and ${inArray(addonTag.tagId, tags)}`;

	switch (query.tagMatch ?? 'any') {
		case 'any': {
			return sql`exists (select 1 ${tagged})`;
		}
		case 'all': {
			return sql`(select count(*) ${tagged}) = ${tags.length}`;
		}
		case 'none': {
			return sql`not exists (select 1 ${tagged})`;
		}
	}
}

// Authors are the newest live version's manifest `authors`, the ones the listing card credits.
function authorFilter(table: ListingTable, query: ListingFilters) {
	const ids = splitList(query.authors);

	if (ids.length === 0) return;

	const served = sql`select ${addonVersion.manifest} -> 'authors' from ${addonVersion} where ${addonVersion.addonId} = ${table.id} and ${addonVersion.withdrawnBy} is null order by ${addonVersion.versionKey} desc limit 1`;
	const credited = sql`exists (select 1 from json_array_elements((${served})) as author where author ->> 'id' in (${sql.join(
		ids.map((id) => sql`${id}`),
		sql`, `,
	)}))`;

	return query.authorMatch === 'none' ? sql`not ${credited}` : credited;
}

function updatedFilter(ctx: AppContext, table: ListingTable, query: ListingFilters) {
	if (!query.updated) return;

	const since = new Date(ctx.now().getTime() - Number(query.updated) * DAY_MS);

	return query.updatedMatch === 'none' ? lt(table.updatedAt, since) : gte(table.updatedAt, since);
}

/**
 * @description Builds the one statement behind {@link listAddons}: one page plus a lookahead row,
 * keyset-paginated over the sort column and id so every filter and sort reads one index.
 * @param ctx The application context.
 * @param query The type, tag, author and update filters, search text, sort and the previous page's cursor.
 * @returns The unexecuted relational query.
 */
export function queryListedAddons(ctx: AppContext, query: ListAddonsQuery = {}) {
	const { type, q, sort = 'name', order = 'asc', cursor } = query;
	const column = SORT_COLUMNS[sort];
	const after = cursor ? decodeCursor<CursorPosition>(cursor, CURSOR_SCHEMAS[sort]) : undefined;

	return ctx.db.query.addon.findMany({
		where: {
			delistedAt: { isNull: true },
			type: type ?? EmptyFilter,
			RAW: (table) =>
				and(
					q
						? or(likeContains(table.name, q), likeContains(table.description, q))
						: undefined,
					tagFilter(table, query),
					authorFilter(table, query),
					updatedFilter(ctx, table, query),
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
			? [
					{
						id: row.id,
						type: row.type,
						name: row.name,
						description: row.description,
						icon: row.icon,
						latestVersion: toAddonVersion(ctx.env, latest, latest.submission),
					},
				]
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
 * @description Loads every listed addon with its newest version, ordered by id.
 * @param ctx The application context.
 * @returns The listed addons.
 */
export async function listListedAddons(ctx: AppContext): Promise<ListedAddon[]> {
	const rows = await ctx.db.query.addon.findMany({
		where: { delistedAt: { isNull: true } },
		with: LATEST_VERSION,
		orderBy: { id: 'asc' },
	});

	return toListedAddons(ctx, rows);
}

/**
 * @description Snapshots every listed addon with its newest version, ordered by id. The revision is a
 * hash of the snapshot, so it changes exactly when an approval, delist or relist changes what is listed.
 * @param ctx The application context.
 * @returns The catalog and its revision.
 */
export async function getCatalog(ctx: AppContext): Promise<CatalogResponse> {
	const addons = await listListedAddons(ctx);
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
			versions: {
				where: LIVE_VERSIONS,
				orderBy: { versionKey: 'desc' },
				with: VERSION_SOURCE,
			},
			maintainers: MAINTAINERS,
		},
	});

	if (!row) return;

	const latest = row.versions[0]?.submission?.source;

	return {
		id: row.id,
		type: row.type,
		name: row.name,
		description: row.description,
		icon: row.icon,
		createdAt: row.createdAt.toISOString(),
		versions: row.versions.map((version) =>
			toAddonVersion(ctx.env, version, version.submission),
		),
		maintainers: toMaintainers(row.maintainers),
		addonMd: latest?.addonMd ?? null,
		details: latest?.details ?? null,
	};
}

/**
 * @description Lists every approved version of a listed addon that no rollback withdrew, newest first.
 * @param ctx The application context.
 * @param id The addon id.
 * @returns The versions, or `undefined` when the addon does not exist or is delisted.
 */
export async function listAddonVersions(
	ctx: AppContext,
	id: string,
): Promise<AddonVersion[] | undefined> {
	const row = await ctx.db.query.addon.findFirst({
		where: { id, delistedAt: { isNull: true } },
		with: {
			versions: {
				where: LIVE_VERSIONS,
				orderBy: { versionKey: 'desc' },
				with: VERSION_SOURCE,
			},
		},
	});

	if (!row) return;

	return row.versions.map((version) => toAddonVersion(ctx.env, version, version.submission));
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
	const loaded = await ctx.db.query.submission.findMany({
		where: {
			status: { in: OPEN_SUBMISSION_STATUSES },
			OR: [{ addonId: { in: ids } }, { authorId: userId, kind: 'listing' }],
		},
		with: { source: true },
		orderBy: { createdAt: 'asc', id: 'asc' },
	});

	const open = loaded.map(requireSourced);
	const addons = memberships.flatMap(({ addon: row, role }) => {
		if (!row) {
			return [];
		}

		const [latest] = row.versions;

		return [
			{
				...toAddon(row),
				role,
				latestVersion: latest ? toAddonVersion(ctx.env, latest, latest.submission) : null,
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
	PINNED_FIELDS,
	LATEST_VERSION,
	toAddon,
	getManifestType,
	toAddonSummary,
	refreshAddonSummary,
	writeDelisted,
	delistAddon,
	relistAddon,
	queryListedAddons,
	listAddons,
	listListedAddons,
	getCatalog,
	getAddonDetails,
	listAddonVersions,
	listMyAddons,
};
