import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { join } from 'node:path';

import type { Database } from '~/db/database';

export const MIGRATIONS_FOLDER = join(import.meta.dirname, '..', '..', 'drizzle');

/**
 * @description Applies every pending drizzle-kit migration from `apps/discord-bot/drizzle`, keeping its
 * history in schema `bot` apart from the web's. Run it after the web's migrations and provisioning.
 * @param db The database to migrate, over the direct url.
 * @returns Resolves once every migration is applied.
 */
export async function migrateDatabase(db: Database): Promise<void> {
	await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER, migrationsSchema: 'bot' });
}

export default { MIGRATIONS_FOLDER, migrateDatabase };
