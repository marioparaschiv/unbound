import {
	boolean,
	pgTable,
	text,
	index,
	integer,
	doublePrecision,
	jsonb,
} from 'drizzle-orm/pg-core';
import type { CrashContext } from '@unbound-app/contracts/crash-reports';

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
		installId: text('install_id'),
		addonId: text('addon_id'),
		addonVersion: text('addon_version'),
		addonTrust: text('addon_trust'),
		phase: text('phase'),
		seconds: doublePrecision('seconds'),
		message: text('message'),
		stack: text('stack'),
		log: text('log'),
		context: jsonb('context').$type<CrashContext>(),
		origin: text('origin'),
		fingerprint: text('fingerprint'),
		receivedAt: timestampMs('received_at').notNull(),
	},
	(table) => [
		index('crash_report_addonId_receivedAt_idx').on(table.addonId, table.receivedAt),
		index('crash_report_receivedAt_idx').on(table.receivedAt),
		index('crash_report_fingerprint_install_idx').on(table.fingerprint, table.installId),
		index('crash_report_addon_version_idx').on(
			table.addonId,
			table.addonVersion,
			table.receivedAt,
		),
	],
);

/** The GitHub issue that tracks one kind of crash, so repeated reports of it never open another. */
export const crashIssue = pgTable('crash_issue', {
	fingerprint: text('fingerprint').primaryKey(),
	issueNumber: integer('issue_number'),
	issueUrl: text('issue_url'),
	reports: integer('reports').notNull().default(1),
	versions: text('versions').notNull(),
	firstSeenAt: timestampMs('first_seen_at').notNull(),
	lastSeenAt: timestampMs('last_seen_at').notNull(),
});
