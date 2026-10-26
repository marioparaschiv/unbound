import { pgTable, text, integer, boolean, json, index, primaryKey } from 'drizzle-orm/pg-core';
import type { PerkId, SponsorshipState } from '@unbound-app/contracts/sponsors';

import { timestampMs } from './columns';
import { user } from './auth';

export const sponsorship = pgTable('sponsorship', {
	githubId: text('github_id').primaryKey(),
	githubLogin: text('github_login').notNull(),
	state: text('state').$type<SponsorshipState>().notNull(),
	tierName: text('tier_name').notNull(),
	monthlyPriceCents: integer('monthly_price_cents').notNull(),
	oneTime: boolean('one_time').notNull(),
	since: timestampMs('since').notNull(),
	endsAt: timestampMs('ends_at'),
	updatedAt: timestampMs('updated_at').notNull(),
});

export const sponsorWebhookDelivery = pgTable(
	'sponsor_webhook_delivery',
	{
		id: text('id').primaryKey(),
		action: text('action').notNull(),
		receivedAt: timestampMs('received_at').notNull(),
	},
	(table) => [index('sponsor_webhook_delivery_receivedAt_idx').on(table.receivedAt)],
);

export const perkClaim = pgTable(
	'perk_claim',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		perkId: text('perk_id').$type<PerkId>().notNull(),
		config: json('config').notNull(),
		createdAt: timestampMs('created_at').notNull(),
		updatedAt: timestampMs('updated_at').notNull(),
		revokedAt: timestampMs('revoked_at'),
		revokedBy: text('revoked_by').references(() => user.id, { onDelete: 'set null' }),
		revokeReason: text('revoke_reason'),
	},
	(table) => [primaryKey({ columns: [table.userId, table.perkId] })],
);
