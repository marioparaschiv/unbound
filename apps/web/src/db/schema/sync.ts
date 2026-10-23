import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { SyncDocument } from '@unbound-app/contracts/sync';

import { user } from './auth';

/** A user's Cloud Sync document. `revision` grows by one on every save, for optimistic concurrency. */
export const syncDocument = sqliteTable('sync_document', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	revision: integer('revision').notNull(),
	document: text('document', { mode: 'json' }).$type<SyncDocument>().notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
