import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
import type { PerkId, SponsorshipState } from '@unbound-app/contracts/sponsors';

import { user } from './auth';

export const sponsorship = sqliteTable('sponsorship', {
	githubId: text('github_id').primaryKey(),
	githubLogin: text('github_login').notNull(),
	state: text('state').$type<SponsorshipState>().notNull(),
	tierName: text('tier_name').notNull(),
	monthlyPriceCents: integer('monthly_price_cents').notNull(),
	oneTime: integer('one_time', { mode: 'boolean' }).notNull(),
	since: integer('since', { mode: 'timestamp_ms' }).notNull(),
	endsAt: integer('ends_at', { mode: 'timestamp_ms' }),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sponsorWebhookDelivery = sqliteTable(
	'sponsor_webhook_delivery',
	{
		id: text('id').primaryKey(),
		action: text('action').notNull(),
		receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [index('sponsor_webhook_delivery_receivedAt_idx').on(table.receivedAt)],
);

export const perkClaim = sqliteTable(
	'perk_claim',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		perkId: text('perk_id').$type<PerkId>().notNull(),
		config: text('config', { mode: 'json' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
		revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
		revokedBy: text('revoked_by').references(() => user.id, { onDelete: 'set null' }),
		revokeReason: text('revoke_reason'),
	},
	(table) => [primaryKey({ columns: [table.userId, table.perkId] })],
);
