import { pgTable, text, integer, json } from 'drizzle-orm/pg-core';
import type { SyncDocument } from '@unbound-app/contracts/sync';

import { timestampMs } from './columns';
import { user } from './auth';

/** A user's Cloud Sync document. `revision` grows by one on every save, for optimistic concurrency. */
export const syncDocument = pgTable('sync_document', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	revision: integer('revision').notNull(),
	document: json('document').$type<SyncDocument>().notNull(),
	updatedAt: timestampMs('updated_at').notNull(),
});
