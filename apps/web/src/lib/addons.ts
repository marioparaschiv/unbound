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
import {
	addonIdSchema,
	addonManifestSchema,
	type PublishedManifest,
} from '@unbound-app/contracts/manifest';
import { and, EmptyFilter, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { safeParse, Type, type TSchema } from '@unbound-app/contracts/schema';
import type { RepositoryDetails } from '@unbound-app/contracts/source';
import type { AddonPage } from '@unbound-app/contracts/addon-page';
import type { PinnableField } from '@unbound-app/contracts/admin';
import { createLogger } from '@unbound-app/logger';

import {
	LISTED_ADDONS,
	LIVE_VERSIONS,
	SERVED_VERSION,
	requireAddon,
	servedVersionValue,
} from '~/lib/addon-visibility';
import { OPEN_SUBMISSION_STATUSES, requireSourced, toSubmission } from '~/lib/submissions';
import type { AddonVersionRow, VersionSubmission } from '~/lib/artifacts';
import { VERSION_SOURCE, toAddonVersion } from '~/lib/artifacts';
import { MAINTAINERS, toMaintainers } from '~/lib/maintainers';
import { addon, addonTag, addonVersion } from '~/db/schema';
import type { ActionMeta } from '~/lib/moderation-events';
import { cursorTime, keysetList } from '~/lib/keyset';
import { appendEvent } from '~/lib/moderation-events';
import { requirePermission } from '~/lib/api/caller';
import { renderAddonIcon } from '~/lib/addon-icons';
import { likeContains } from '~/lib/like-contains';
import type { Transaction } from '~/db/database';
import { readAddonTags } from '~/lib/addon-tags';
import { splitList } from '~/lib/addon-filters';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { DAY_MS } from '~/lib/calendar-date';
import one from '~/db/one';

const logger = createLogger('Web', 'Addons');

export type AddonRow = typeof addon.$inferSelect;

export type AddonSummary = Pick<AddonRow, 'type' | 'name' | 'description' | 'updatedAt'>;

export type AddonDetails = {
	id: string;
	type: AddonType;
	name: string;
	description: string;
	icon: string | null;
	/** How many times clients installed the addon from the marketplace. */
	installs: number;
	createdAt: string;
	/** Newest first, withdrawn ones left out; the first is served. */
	versions: AddonVersion[];
	maintainers: Maintainer[];
	/** The newest version's ADDON.md, or `null` when it has none or predates GitHub sources. */
	addonMd: string | null;
	/** The newest version's measured store page, or `null` when it has none. */
	page: AddonPage | null;
	/** The newest version's GitHub details, or `null` when it predates GitHub sources. */
	details: RepositoryDetails | null;
};

type SourcedVersionRow = AddonVersionRow & { submission: VersionSubmission | null };

type ListedAddonRow = Pick<
	AddonRow,
	'id' | 'type' | 'name' | 'description' | 'icon' | 'installs' | 'createdAt'
> & {
	versions: SourcedVersionRow[];
};

type PinnableColumn = (typeof addon)[PinnableField];

type ManifestTypeFields = Pick<PublishedManifest, 'type' | 'main'>;

type ListingTable = Pick<typeof addon, 'id' | 'updatedAt'>;

type ListingFilters = NonNullable<ListAddonsQuery>;

const SORT_COLUMNS = {
	name: 'name',
	created: 'createdAt',
	updated: 'updatedAt',
} as const satisfies Record<AddonSort, keyof AddonRow>;

const CURSOR_SCHEMAS = {
	name: Type.Tuple([Type.String(), addonIdSchema]),
	created: Type.Tuple([cursorTime, addonIdSchema]),
	updated: Type.Tuple([cursorTime, addonIdSchema]),
} satisfies Record<AddonSort, TSchema>;

/** The `addon.pinned_fields` bit of each summary field a staff edit can own. */
export const PINNED_FIELDS = {
	name: 1 << 0,
	description: 1 << 1,
	type: 1 << 2,
} as const satisfies Record<PinnableField, number>;

/** The relational `with` that loads the version an addon serves: its newest live version. */
export const WITH_SERVED_VERSION = {
	versions: { ...SERVED_VERSION, with: VERSION_SOURCE },
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
	const row = await tx.query.addon.findFirst({
		where: { id: addonId },
		columns: { id: true },
		with: { versions: { ...SERVED_VERSION, columns: { manifest: true, publishedAt: true } } },
	});
	const latest = row?.versions[0];

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

		return writeDelisted(tx, requireAddon(current, addonId), delisted, {
			actorId: caller.user.id,
			at,
		});
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

	const served = servedVersionValue(table, sql`${addonVersion.manifest} -> 'authors'`);
	const credited = sql`exists (select 1 from json_array_elements(${served}) as author where author ->> 'id' in (${sql.join(
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
 * @description Builds one page of {@link listAddons}, keyset-paginated over the sort column and id so
 * every filter and sort reads one index.
 * @param ctx The application context.
 * @param query The type, tag, author and update filters, search text, sort and the previous page's cursor.
 * @returns The page's statement and its reader.
 */
export function queryListedAddons(ctx: AppContext, query: ListAddonsQuery = {}) {
	const { type, q, sort = 'name', order = 'asc' } = query;

	return keysetList({
		key: [SORT_COLUMNS[sort], 'id'],
		schema: CURSOR_SCHEMAS[sort],
		request: query,
		order,
		size: ctx.env.ADDON_LIST_PAGE_SIZE,
		query: (page) =>
			ctx.db.query.addon.findMany({
				where: {
					...LISTED_ADDONS,
					type: type ?? EmptyFilter,
					RAW: (table) =>
						and(
							q
								? or(
										likeContains(table.name, q),
										likeContains(table.description, q),
									)
								: undefined,
							tagFilter(table, query),
							authorFilter(table, query),
							updatedFilter(ctx, table, query),
							page.where(table),
						) ?? sql`true`,
				},
				with: WITH_SERVED_VERSION,
				orderBy: (table) => page.orderBy(table),
				limit: page.limit,
			}),
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
						iconSvg: renderAddonIcon(row.icon),
						installs: row.installs,
						createdAt: row.createdAt.toISOString(),
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
	const page = await queryListedAddons(ctx, query).page();

	return { addons: toListedAddons(ctx, page.items), nextCursor: page.next };
}

/**
 * @description Loads every listed addon with its newest version, ordered by id.
 * @param ctx The application context.
 * @param type Only addons of this type; every type when omitted.
 * @returns The listed addons.
 */
export async function listListedAddons(ctx: AppContext, type?: AddonType): Promise<ListedAddon[]> {
	const rows = await ctx.db.query.addon.findMany({
		where: { ...LISTED_ADDONS, type: type ?? EmptyFilter },
		with: WITH_SERVED_VERSION,
		orderBy: { id: 'asc' },
	});

	return toListedAddons(ctx, rows);
}

/**
 * @description Snapshots every listed addon with its newest version and tags, ordered by id. The revision
 * is a hash of the snapshot, so it changes exactly when an approval, delist, relist, retag or counted install changes it.
 * @param ctx The application context.
 * @returns The catalog and its revision.
 */
export async function getCatalog(ctx: AppContext): Promise<CatalogResponse> {
	const listed = await listListedAddons(ctx);
	const tags = await readAddonTags(
		ctx,
		listed.map((entry) => entry.id),
	);
	const addons = listed.map((entry) => ({ ...entry, tags: tags.get(entry.id) ?? [] }));
	const revision = new Bun.CryptoHasher('sha256').update(JSON.stringify(addons)).digest('hex');

	return { revision, addons };
}

/**
 * @description Counts one anonymous marketplace install of a listed addon. Nothing about the installer is stored.
 * @param ctx The application context.
 * @param id The addon id.
 * @returns The addon's install count, or `undefined` when it does not exist or is delisted.
 */
export async function countAddonInstall(ctx: AppContext, id: string): Promise<number | undefined> {
	const [row] = await ctx.db
		.update(addon)
		.set({ installs: sql`${addon.installs} + 1` })
		.where(and(eq(addon.id, id), isNull(addon.delistedAt)))
		.returning({ installs: addon.installs });

	return row?.installs;
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
		where: { ...LISTED_ADDONS, id },
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
		installs: row.installs,
		createdAt: row.createdAt.toISOString(),
		versions: row.versions.map((version) =>
			toAddonVersion(ctx.env, version, version.submission),
		),
		maintainers: toMaintainers(row.maintainers),
		addonMd: latest?.addonMd ?? null,
		page: latest?.page ?? null,
		details: latest?.details ?? null,
	};
}

/**
 * @description Lists every approved version of a listed addon that no rollback withdrew and whose
 * manifest still parses, newest first.
 * @param ctx The application context.
 * @param id The addon id.
 * @returns The versions, or `undefined` when the addon does not exist or is delisted.
 */
export async function listAddonVersions(
	ctx: AppContext,
	id: string,
): Promise<AddonVersion[] | undefined> {
	const row = await ctx.db.query.addon.findFirst({
		where: { ...LISTED_ADDONS, id },
		with: {
			versions: {
				where: LIVE_VERSIONS,
				orderBy: { versionKey: 'desc' },
				with: VERSION_SOURCE,
			},
		},
	});

	if (!row) return;

	return row.versions.flatMap((version) => {
		// Versions published before the manifest format changed (`platforms` as an array) no longer
		// match the contract, and no current client can install them.
		if (!safeParse(addonManifestSchema, version.manifest).success) {
			logger.warn(
				`Skipped version ${version.version} of ${id}: its manifest no longer parses.`,
			);

			return [];
		}

		return [toAddonVersion(ctx.env, version, version.submission)];
	});
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
		with: { addon: { with: WITH_SERVED_VERSION } },
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
	WITH_SERVED_VERSION,
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
	countAddonInstall,
	getAddonDetails,
	listAddonVersions,
	listMyAddons,
};
