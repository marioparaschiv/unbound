import { boolean, pgTable, text, index, doublePrecision } from 'drizzle-orm/pg-core';

import { timestampMs } from './columns';

export const crashReport = pgTable(
	'crash_report',
	{
		id: text('id').primaryKey(),
		kind: text('kind').notNull(),
		platform: text('platform').notNull(),
		clientVersion: text('client_version').notNull(),
		loaderVersion: text('loader_version').notNull(),
		discordVersion: text('discord_version').notNull(),
		osVersion: text('os_version').notNull(),
		deviceModel: text('device_model').notNull(),
		verifiedBuild: boolean('verified_build'),
		addonId: text('addon_id'),
		addonVersion: text('addon_version'),
		addonTrust: text('addon_trust'),
		phase: text('phase'),
		seconds: doublePrecision('seconds'),
		message: text('message'),
		stack: text('stack'),
		log: text('log'),
		receivedAt: timestampMs('received_at').notNull(),
	},
	(table) => [
		index('crash_report_addonId_receivedAt_idx').on(table.addonId, table.receivedAt),
		index('crash_report_receivedAt_idx').on(table.receivedAt),
	],
);
