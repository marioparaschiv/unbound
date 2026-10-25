import { bigint, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import type { EventActor } from '~/lib/feed/types';

export const auditEvent = pgTable('audit_event', {
	id: bigint('id', { mode: 'number' }).primaryKey(),
	kind: text('kind').notNull(),
	subjectType: text('subject_type').notNull(),
	subjectId: text('subject_id').notNull(),
	subjectName: text('subject_name'),
	actor: jsonb('actor').$type<EventActor>(),
	data: jsonb('data'),
	reason: text('reason'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	channelId: text('channel_id'),
	messageId: text('message_id'),
});
