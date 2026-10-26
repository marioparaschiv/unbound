import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '~/db/database';

type HistoryTable = {
	table: string | null;
};

type AppliedCount = {
	applied: number;
};

export const MIGRATIONS_FOLDER = join(import.meta.dirname, '..', '..', 'drizzle');

function countLocalMigrations() {
	return readdirSync(MIGRATIONS_FOLDER).filter((name) =>
		existsSync(join(MIGRATIONS_FOLDER, name, 'migration.sql')),
	).length;
}

async function countAppliedMigrations(db: Database) {
	const [history] = await db.$client<
		HistoryTable[]
	>`select to_regclass('bot.__drizzle_migrations')::text as table`;

	if (!history?.table) {
		return 0;
	}

	const [row] = await db.$client<
		AppliedCount[]
	>`select count(*)::int as applied from bot.__drizzle_migrations`;

	return row?.applied ?? 0;
}

/**
 * @description Applies every pending drizzle-kit migration from `apps/discord-bot/drizzle`, keeping its
 * history in schema `bot` apart from the web's. Run it after the web's migrations and provisioning.
 * @param db The database to migrate, over the direct url.
 * @returns Resolves once every migration is applied.
 */
export async function migrateDatabase(db: Database): Promise<void> {
	// Drizzle's migrator always runs CREATE SCHEMA, which needs CREATE on the database. Provisioning's lock
	// phase takes that back, so an up-to-date database is left alone.
	if ((await countAppliedMigrations(db)) >= countLocalMigrations()) return;

	await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER, migrationsSchema: 'bot' });
}

export default { MIGRATIONS_FOLDER, migrateDatabase };
