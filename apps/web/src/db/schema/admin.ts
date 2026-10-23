import type { ModerationEventKind, SubjectType } from '@unbound-app/contracts/admin';
import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
import { defineRelationsPart, sql } from 'drizzle-orm';

import { addon } from './addons';
import { user } from './auth';

/**
 * Append-only log of every moderation action on addons and users; write it only through
 * `appendEvent`. `subject_id` has no foreign key so the history outlives its subject.
 */
export const moderationEvent = sqliteTable(
	'moderation_event',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		subjectType: text('subject_type').$type<SubjectType>().notNull(),
		subjectId: text('subject_id').notNull(),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
		kind: text('kind').$type<ModerationEventKind>().notNull(),
		// The kind's payload, parsed through `moderationEventDataSchema` on read.
		data: text('data', { mode: 'json' }).notNull(),
		/** The human "why": a review note, a rollback reason, an edit reason. */
		reason: text('reason'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	},
	// The index carries the rowid, so a subject's timeline reads newest first without sorting.
	(table) => [index('moderation_event_subject_idx').on(table.subjectType, table.subjectId)],
);

/**
 * A private staff note on exactly one user or addon, deleted with its subject; write it only
 * through `~/lib/staff-notes`. No public endpoint reads it.
 */
export const staffNote = sqliteTable(
	'staff_note',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		addonId: text('addon_id').references(() => addon.id, { onDelete: 'cascade' }),
		authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
		body: text('body').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		editedAt: integer('edited_at', { mode: 'timestamp_ms' }),
	},
	(table) => [
		check(
			'staff_note_one_subject',
			sql`(${table.userId} is null) <> (${table.addonId} is null)`,
		),
		index('staff_note_user_idx')
			.on(table.userId)
			.where(sql`${table.userId} is not null`),
		index('staff_note_addon_idx')
			.on(table.addonId)
			.where(sql`${table.addonId} is not null`),
	],
);

export const adminRelations = defineRelationsPart({ user, moderationEvent, staffNote }, (r) => ({
	moderationEvent: {
		actor: r.one.user({
			from: r.moderationEvent.actorId,
			to: r.user.id,
		}),
	},
	staffNote: {
		author: r.one.user({
			from: r.staffNote.authorId,
			to: r.user.id,
		}),
	},
}));
