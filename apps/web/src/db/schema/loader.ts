import type {
	PublishAndroidBuildRequest,
	AndroidChannel,
} from '@unbound-app/contracts/android-builds';
import { pgTable, text, index, primaryKey, integer, jsonb } from 'drizzle-orm/pg-core';
import type { DiscordCompatPlatform } from '@unbound-app/contracts/discord-compat';
import type { BundleChannel, LoaderPlatform } from '@unbound-app/contracts/loader';

import { timestampMs } from './columns';
import { user } from './auth';

export const loaderRelease = pgTable(
	'loader_release',
	{
		platform: text('platform').$type<LoaderPlatform>().notNull(),
		version: text('version').notNull(),
		versionKey: text('version_key').notNull(),
		url: text('url').notNull(),
		changelog: text('changelog'),
		publishedBy: text('published_by').references(() => user.id, { onDelete: 'set null' }),
		publishedAt: timestampMs('published_at').notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.platform, table.version] }),
		index('loader_release_platform_versionKey_idx').on(table.platform, table.versionKey),
	],
);

/** A client bundle CI published, with the oldest loader that runs it. */
export const bundleRelease = pgTable(
	'bundle_release',
	{
		channel: text('channel').$type<BundleChannel>().notNull(),
		version: text('version').notNull(),
		minLoaderVersion: text('min_loader_version').notNull(),
		publishedBy: text('published_by').references(() => user.id, { onDelete: 'set null' }),
		publishedAt: timestampMs('published_at').notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.channel, table.version] }),
		index('bundle_release_channel_publishedAt_idx').on(table.channel, table.publishedAt),
	],
);

/** A patched Discord build whose gzipped splits CI uploaded to the public bucket, one per Discord version and loader commit. */
export const androidBuild = pgTable(
	'android_build',
	{
		channel: text('channel').$type<AndroidChannel>().notNull(),
		discordVersionCode: integer('discord_version_code').notNull(),
		commit: text('commit').notNull(),
		discordVersion: text('discord_version').notNull(),
		splits: jsonb('splits').$type<PublishAndroidBuildRequest['splits']>().notNull(),
		publishedBy: text('published_by').references(() => user.id, { onDelete: 'set null' }),
		publishedAt: timestampMs('published_at').notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.channel, table.discordVersionCode, table.commit] }),
		index('android_build_channel_order_idx').on(
			table.channel,
			table.discordVersionCode,
			table.publishedAt,
		),
	],
);

export const discordCompat = pgTable(
	'discord_compat',
	{
		platform: text('platform').$type<DiscordCompatPlatform>().notNull(),
		version: text('version').notNull(),
		build: text('build'),
		channel: text('channel').notNull(),
		broken: integer('broken').notNull(),
		fallbacks: integer('fallbacks').notNull(),
		scannedAt: timestampMs('scanned_at').notNull(),
	},
	(table) => [primaryKey({ columns: [table.platform, table.version] })],
);
