import {
	sqliteTable,
	text,
	integer,
	index,
	uniqueIndex,
	primaryKey,
} from 'drizzle-orm/sqlite-core';
import type {
	ReviewDecision,
	SubmissionKind,
	SubmissionStatus,
} from '@unbound-app/contracts/publish';
import type { AddonType, MaintainerRole } from '@unbound-app/contracts/addons';
import { openSubmissionStatusSchema } from '@unbound-app/contracts/publish';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { defineRelationsPart, sql } from 'drizzle-orm';

import { user } from './auth';

// Index predicates are stored in the schema verbatim, so the statuses are inlined rather than bound.
const OPEN_STATUSES = `(${openSubmissionStatusSchema.options.map((status) => `'${status}'`).join(', ')})`;

const LISTING_SORTS = ['name', 'createdAt', 'updatedAt'] as const;

/**
 * An approved addon. The row is created when its first listing is approved; until then a pending listing submission holds the id.
 * `addon_search` mirrors its id and name for admin search; the `admin_search` migration owns it.
 */
export const addon = sqliteTable(
	'addon',
	{
		id: text('id').primaryKey(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		delistedAt: integer('delisted_at', { mode: 'timestamp_ms' }),
		// The newest version's type, name, description and approval time, copied here on approval so
		// listings filter, search and sort on one table.
		type: text('type').$type<AddonType>().notNull(),
		name: text('name').notNull(),
		description: text('description').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
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
		// The admin addons list, delisted ones included; its published-range filter reads it too.
		index('addon_createdAt_idx').on(table.createdAt, table.id),
	],
);

export const addonMaintainer = sqliteTable(
	'addon_maintainer',
	{
		addonId: text('addon_id')
			.notNull()
			.references(() => addon.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role').$type<MaintainerRole>().notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.addonId, table.userId] }),
		index('addon_maintainer_userId_idx').on(table.userId),
	],
);

export const submission = sqliteTable(
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
		manifest: text('manifest', { mode: 'json' }).$type<PublishedManifest>().notNull(),
		changelog: text('changelog'),
		/** The GitHub `owner/name` the author proved push access to; `null` is an unverified source. */
		repository: text('repository'),
		bundleSize: integer('bundle_size').notNull(),
		stagingKey: text('staging_key').notNull().unique(),
		uploadExpiresAt: integer('upload_expires_at', { mode: 'timestamp_ms' }).notNull(),
		/** Lowercase hex SHA-256 of the staged bundle, recorded on finalize. */
		sha256: text('sha256'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }),
		reviewerId: text('reviewer_id').references(() => user.id, { onDelete: 'set null' }),
		reviewDecision: text('review_decision').$type<ReviewDecision>(),
		reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
		reviewNote: text('review_note'),
	},
	(table) => [
		index('submission_addonId_status_idx').on(table.addonId, table.status),
		index('submission_authorId_createdAt_idx').on(table.authorId, table.createdAt),
		// The review queue and the staging sweeper's lapsed reservations.
		index('submission_status_submittedAt_idx').on(table.status, table.submittedAt),
		// An open listing is the claim on its addon id.
		uniqueIndex('submission_listing_claim_uidx')
			.on(table.addonId)
			.where(sql`${table.kind} = 'listing' and ${table.status} in ${sql.raw(OPEN_STATUSES)}`),
	],
);

/** The approved versions of an addon: the source of truth for what exists and which is latest. */
export const addonVersion = sqliteTable(
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
		manifest: text('manifest', { mode: 'json' }).$type<PublishedManifest>().notNull(),
		changelog: text('changelog'),
		bundleSize: integer('bundle_size').notNull(),
		sha256: text('sha256').notNull(),
		publishedAt: integer('published_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.addonId, table.version] }),
		// An addon's newest version, read in version order without sorting.
		index('addon_version_addonId_versionKey_idx').on(table.addonId, table.versionKey),
	],
);

export const addonRelations = defineRelationsPart(
	{ user, addon, addonMaintainer, submission, addonVersion },
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
		submission: {
			author: r.one.user({
				from: r.submission.authorId,
				to: r.user.id,
			}),
		},
		addonVersion: {
			addon: r.one.addon({
				from: r.addonVersion.addonId,
				to: r.addon.id,
			}),
			submission: r.one.submission({
				from: r.addonVersion.submissionId,
				to: r.submission.id,
			}),
		},
	}),
);
