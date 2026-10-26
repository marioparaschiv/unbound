import {
	pgTable,
	text,
	integer,
	bigint,
	json,
	index,
	uniqueIndex,
	primaryKey,
} from 'drizzle-orm/pg-core';
import type {
	ReviewDecision,
	SubmissionKind,
	SubmissionStatus,
} from '@unbound-app/contracts/publish';
import type { AddonType, MaintainerRole } from '@unbound-app/contracts/addons';
import { openSubmissionStatusSchema } from '@unbound-app/contracts/publish';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { defineRelationsPart, sql, type SQL } from 'drizzle-orm';

import { searchText, timestampMs, trigramIndex } from './columns';
import { moderationEvent } from './admin';
import { user } from './auth';

// Index predicates are stored in the schema verbatim, so the statuses are inlined rather than bound.
const OPEN_STATUSES = `(${openSubmissionStatusSchema.options.map((status) => `'${status}'`).join(', ')})`;

const LISTING_SORTS = ['name', 'createdAt', 'updatedAt'] as const;

/**
 * An approved addon. The row is created when its first listing is approved; until then a pending listing submission holds the id.
 */
export const addon = pgTable(
	'addon',
	{
		id: text('id').primaryKey(),
		createdAt: timestampMs('created_at').defaultNow().notNull(),
		delistedAt: timestampMs('delisted_at'),
		// Copied from the served version on approval and rollback so listings filter, search and sort on
		// one table. A staff edit pins a field instead.
		type: text('type').$type<AddonType>().notNull(),
		name: text('name').notNull(),
		description: text('description').notNull(),
		updatedAt: timestampMs('updated_at').notNull(),
		/** `PINNED_FIELDS` bits: the summary columns a staff edit owns, which refreshes leave alone. */
		pinnedFields: integer('pinned_fields').default(0).notNull(),
		/** The GitHub `owner/name` of the addon's source. Addon-level, never copied from a manifest. */
		repository: text('repository'),
	},
	(table) => [
		...LISTING_SORTS.flatMap((key) => [
			index(`addon_listed_${key}_idx`)
				.on(table[key], table.id)
				.where(sql`${table.delistedAt} is null`),
			index(`addon_listed_type_${key}_idx`)
				.on(table.type, table[key], table.id)
				.where(sql`${table.delistedAt} is null`),
		]),
		index('addon_createdAt_idx').on(table.createdAt, table.id),
		index('addon_delisted_createdAt_idx')
			.on(table.createdAt, table.id)
			.where(sql`${table.delistedAt} is not null`),
		trigramIndex('addon_search_idx', addonSearchText),
	],
);

/** The text admin search matches an addon by, and the expression `addon_search_idx` indexes. */
export const addonSearchText: SQL = searchText([addon.id, addon.name]);

export const addonMaintainer = pgTable(
	'addon_maintainer',
	{
		addonId: text('addon_id')
			.notNull()
			.references(() => addon.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role').$type<MaintainerRole>().notNull(),
		createdAt: timestampMs('created_at').defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.addonId, table.userId] }),
		index('addon_maintainer_userId_idx').on(table.userId),
	],
);

export const submission = pgTable(
	'submission',
	{
		id: text('id').primaryKey(),
		addonId: text('addon_id').notNull(),
		authorId: text('author_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: text('kind').$type<SubmissionKind>().notNull(),
		status: text('status').$type<SubmissionStatus>().notNull(),
		version: text('version').notNull(),
		manifest: json('manifest').$type<PublishedManifest>().notNull(),
		changelog: text('changelog'),
		repository: text('repository'),
		bundleSize: integer('bundle_size').notNull(),
		stagingKey: text('staging_key').notNull().unique(),
		sha256: text('sha256'),
		createdAt: timestampMs('created_at').notNull(),
		submittedAt: timestampMs('submitted_at'),
		reviewerId: text('reviewer_id').references(() => user.id, { onDelete: 'set null' }),
		reviewDecision: text('review_decision').$type<ReviewDecision>(),
		reviewedAt: timestampMs('reviewed_at'),
		reviewNote: text('review_note'),
	},
	(table) => [
		index('submission_addonId_status_idx').on(table.addonId, table.status),
		index('submission_authorId_createdAt_idx').on(table.authorId, table.createdAt),
		index('submission_status_submittedAt_idx').on(table.status, table.submittedAt),
		// An open listing is the claim on its addon id.
		uniqueIndex('submission_listing_claim_uidx')
			.on(table.addonId)
			.where(sql`${table.kind} = 'listing' and ${table.status} in ${sql.raw(OPEN_STATUSES)}`),
	],
);

/** The approved versions of an addon, never deleted; the newest one not withdrawn is served. */
export const addonVersion = pgTable(
	'addon_version',
	{
		addonId: text('addon_id')
			.notNull()
			.references(() => addon.id, { onDelete: 'cascade' }),
		version: text('version').notNull(),
		/** `version` encoded so string order is semver precedence; see `toVersionKey`. */
		versionKey: text('version_key').notNull(),
		/** The key of the manifest's `unbound.min`, or `''` when it sets none. */
		minClientKey: text('min_client_key').notNull(),
		submissionId: text('submission_id')
			.notNull()
			.references(() => submission.id),
		manifest: json('manifest').$type<PublishedManifest>().notNull(),
		changelog: text('changelog'),
		bundleSize: integer('bundle_size').notNull(),
		sha256: text('sha256').notNull(),
		publishedAt: timestampMs('published_at').defaultNow().notNull(),
		/** The rollback event that withdrew this version from serving; `null` is live. */
		withdrawnBy: bigint('withdrawn_by', { mode: 'number' }).references(
			() => moderationEvent.id,
		),
	},
	(table) => [
		primaryKey({ columns: [table.addonId, table.version] }),
		// An addon's newest version, read in version order without sorting.
		index('addon_version_addonId_versionKey_idx').on(table.addonId, table.versionKey),
		index('addon_version_live_idx')
			.on(table.addonId, table.versionKey)
			.where(sql`${table.withdrawnBy} is null`),
	],
);

export const addonRelations = defineRelationsPart(
	{ user, addon, addonMaintainer, addonVersion },
	(r) => ({
		addon: {
			maintainers: r.many.addonMaintainer({
				from: r.addon.id,
				to: r.addonMaintainer.addonId,
			}),
			versions: r.many.addonVersion({
				from: r.addon.id,
				to: r.addonVersion.addonId,
			}),
		},
		addonMaintainer: {
			addon: r.one.addon({
				from: r.addonMaintainer.addonId,
				to: r.addon.id,
			}),
			user: r.one.user({
				from: r.addonMaintainer.userId,
				to: r.user.id,
			}),
		},
	}),
);
