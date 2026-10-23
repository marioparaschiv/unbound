import type { ModerationEventKind, SubjectType } from '@unbound-app/contracts/admin';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { defineRelationsPart } from 'drizzle-orm';

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

export const adminRelations = defineRelationsPart({ user, moderationEvent }, (r) => ({
	moderationEvent: {
		actor: r.one.user({
			from: r.moderationEvent.actorId,
			to: r.user.id,
		}),
	},
}));
