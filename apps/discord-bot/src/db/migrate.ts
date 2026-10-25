import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { join } from 'node:path';

import type { Database } from '~/db/database';

export const MIGRATIONS_FOLDER = join(import.meta.dirname, '..', '..', 'drizzle');

/**
 * @description Applies every pending drizzle-kit migration from `apps/discord-bot/drizzle`.
 * @param db The database to migrate.
 * @returns Resolves once every migration is applied.
 */
export async function migrateDatabase(db: Database): Promise<void> {
	await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

export default { MIGRATIONS_FOLDER, migrateDatabase };
