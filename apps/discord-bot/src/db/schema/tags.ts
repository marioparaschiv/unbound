import { serial, text, timestamp } from 'drizzle-orm/pg-core';

import { botSchema } from './bot';

export const tag = botSchema.table('tag', {
	id: serial('id').primaryKey(),
	name: text('name').notNull().unique(),
	content: text('content').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});
