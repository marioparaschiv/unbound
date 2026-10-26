import { pgTable, text, integer, bigint, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { defineRelationsPart, type SQL } from 'drizzle-orm';

import { searchText, timestampMs, trigramIndex } from './columns';

export const user = pgTable(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: boolean('email_verified').default(false).notNull(),
		image: text('image'),
		createdAt: timestampMs('created_at').defaultNow().notNull(),
		updatedAt: timestampMs('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		role: text('role'),
		banned: boolean('banned').default(false),
		banReason: text('ban_reason'),
		banExpires: timestampMs('ban_expires'),
	},
	(table) => [
		index('user_createdAt_idx').on(table.createdAt, table.id),
		trigramIndex('user_search_idx', userSearchText),
	],
);

/** The text admin search matches a user by, and the expression `user_search_idx` indexes. */
export const userSearchText: SQL = searchText([user.id, user.name, user.email]);

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestampMs('expires_at').notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestampMs('created_at').defaultNow().notNull(),
		updatedAt: timestampMs('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		impersonatedBy: text('impersonated_by'),
	},
	(table) => [index('session_userId_idx').on(table.userId)],
);

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestampMs('access_token_expires_at'),
		refreshTokenExpiresAt: timestampMs('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestampMs('created_at').defaultNow().notNull(),
		updatedAt: timestampMs('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestampMs('expires_at').notNull(),
		createdAt: timestampMs('created_at').defaultNow().notNull(),
		updatedAt: timestampMs('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const deviceCode = pgTable(
	'device_code',
	{
		id: text('id').primaryKey(),
		deviceCode: text('device_code').notNull(),
		userCode: text('user_code').notNull(),
		userId: text('user_id'),
		expiresAt: timestampMs('expires_at').notNull(),
		status: text('status').notNull(),
		lastPolledAt: timestampMs('last_polled_at'),
		pollingInterval: bigint('polling_interval', { mode: 'number' }),
		clientId: text('client_id'),
		scope: text('scope'),
	},
	(table) => [
		uniqueIndex('deviceCode_deviceCode_uidx').on(table.deviceCode),
		uniqueIndex('deviceCode_userCode_uidx').on(table.userCode),
	],
);

export const apikey = pgTable(
	'apikey',
	{
		id: text('id').primaryKey(),
		configId: text('config_id').default('default').notNull(),
		name: text('name'),
		start: text('start'),
		referenceId: text('reference_id').notNull(),
		prefix: text('prefix'),
		key: text('key').notNull(),
		refillInterval: bigint('refill_interval', { mode: 'number' }),
		refillAmount: integer('refill_amount'),
		lastRefillAt: timestampMs('last_refill_at'),
		enabled: boolean('enabled').default(true),
		rateLimitEnabled: boolean('rate_limit_enabled').default(true),
		rateLimitTimeWindow: bigint('rate_limit_time_window', { mode: 'number' }).default(86400000),
		rateLimitMax: integer('rate_limit_max').default(1000),
		requestCount: integer('request_count').default(0),
		remaining: integer('remaining'),
		lastRequest: timestampMs('last_request'),
		expiresAt: timestampMs('expires_at'),
		createdAt: timestampMs('created_at').notNull(),
		updatedAt: timestampMs('updated_at').notNull(),
		permissions: text('permissions'),
		metadata: text('metadata'),
	},
	(table) => [
		index('apikey_configId_idx').on(table.configId),
		index('apikey_referenceId_idx').on(table.referenceId),
		index('apikey_key_idx').on(table.key),
	],
);

export const rateLimit = pgTable('rate_limit', {
	id: text('id').primaryKey(),
	key: text('key').notNull().unique(),
	count: integer('count').notNull(),
	lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

export const authRelations = defineRelationsPart(
	{ user, session, account, verification, deviceCode, apikey, rateLimit },
	(r) => ({
		user: {
			sessions: r.many.session({
				from: r.user.id,
				to: r.session.userId,
			}),
			accounts: r.many.account({
				from: r.user.id,
				to: r.account.userId,
			}),
		},
		session: {
			user: r.one.user({
				from: r.session.userId,
				to: r.user.id,
			}),
		},
		account: {
			user: r.one.user({
				from: r.account.userId,
				to: r.user.id,
			}),
		},
	}),
);
