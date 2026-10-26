import type { ModerationEventKind, SubjectType } from '@unbound-app/contracts/admin';
import { pgTable, text, bigint, json, index, check } from 'drizzle-orm/pg-core';
import { defineRelationsPart, sql } from 'drizzle-orm';

import { timestampMs } from './columns';
import { addon } from './addons';
import { user } from './auth';

/** Append-only log of every moderation action on addons and users. */
export const moderationEvent = pgTable(
	'moderation_event',
	{
		// Drawn in commit order, so a reader paging by id never skips an event; see the baseline migration.
		id: bigint('id', { mode: 'number' })
			.primaryKey()
			.default(sql`next_ordered_id('moderation_event_id_seq')`),
		subjectType: text('subject_type').$type<SubjectType>().notNull(),
		subjectId: text('subject_id').notNull(),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
		kind: text('kind').$type<ModerationEventKind>().notNull(),
		data: json('data').notNull(),
		reason: text('reason'),
		createdAt: timestampMs('created_at').notNull(),
	},
	// Ending in `id`, so a subject's timeline reads newest first without sorting.
	(table) => [
		index('moderation_event_subject_idx').on(table.subjectType, table.subjectId, table.id),
	],
);

/** A private staff note on exactly one user or addon, deleted with its subject. */
export const staffNote = pgTable(
	'staff_note',
	{
		// By default, so a data copy can keep the ids.
		id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		addonId: text('addon_id').references(() => addon.id, { onDelete: 'cascade' }),
		authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
		body: text('body').notNull(),
		createdAt: timestampMs('created_at').notNull(),
		editedAt: timestampMs('edited_at'),
	},
	(table) => [
		check(
			'staff_note_one_subject',
			sql`(${table.userId} is null) <> (${table.addonId} is null)`,
		),
		index('staff_note_user_idx')
			.on(table.userId, table.id)
			.where(sql`${table.userId} is not null`),
		index('staff_note_addon_idx')
			.on(table.addonId, table.id)
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
