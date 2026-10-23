import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
import type { PerkId, SponsorshipState } from '@unbound-app/contracts/sponsors';

import { user } from './auth';

/**
 * A GitHub Sponsors sponsorship of the configured account, keyed by the sponsor's GitHub id. Users
 * reach theirs through their linked GitHub `account`, so linking later or unlinking needs no sync.
 */
export const sponsorship = sqliteTable('sponsorship', {
	githubId: text('github_id').primaryKey(),
	githubLogin: text('github_login').notNull(),
	state: text('state').$type<SponsorshipState>().notNull(),
	tierName: text('tier_name').notNull(),
	monthlyPriceCents: integer('monthly_price_cents').notNull(),
	oneTime: integer('one_time', { mode: 'boolean' }).notNull(),
	/** When the sponsorship was created on GitHub. */
	since: integer('since', { mode: 'timestamp_ms' }).notNull(),
	/** When a pending cancellation takes effect, or when the sponsorship was cancelled. */
	endsAt: integer('ends_at', { mode: 'timestamp_ms' }),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

/** Webhook deliveries already applied, so a redelivery changes nothing. */
export const sponsorWebhookDelivery = sqliteTable(
	'sponsor_webhook_delivery',
	{
		id: text('id').primaryKey(),
		action: text('action').notNull(),
		receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [index('sponsor_webhook_delivery_receivedAt_idx').on(table.receivedAt)],
);

/** A perk a user has set up; `config` is validated by the perk's schema in the perk registry. */
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
