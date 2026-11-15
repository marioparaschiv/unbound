import { index, integer, text, timestamp } from 'drizzle-orm/pg-core';

import { botSchema } from './bot';

/** What a moderator did to a user, as Carl-bot named its cases. */
export type CaseAction = 'warn' | 'mute' | 'unmute' | 'kick' | 'softban' | 'ban' | 'unban';

/** One row per moderation action on a server member, numbered as its case; never deleted. */
export const modCase = botSchema.table(
	'mod_case',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		action: text('action').$type<CaseAction>().notNull(),
		userId: text('user_id').notNull(),
		/** The username at the time, so the log reads without a fetch after a rename or deletion. */
		userName: text('user_name').notNull(),
		moderatorId: text('moderator_id').notNull(),
		moderatorName: text('moderator_name').notNull(),
		/** `null` until a moderator gives one, with `reason`. */
		reason: text('reason'),
		/** When a temporary mute or ban ends. */
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		/** When the case stopped applying: a warning pardoned, or a ban lifted or replaced. */
		closedAt: timestamp('closed_at', { withTimezone: true }),
		logChannelId: text('log_channel_id'),
		logMessageId: text('log_message_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('mod_case_user_id_idx').on(table.userId)],
);
