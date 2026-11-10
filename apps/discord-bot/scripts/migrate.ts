import { createLogger } from '@unbound-app/logger';

import { loadDatabaseConfig } from '~/lib/config';
import { createDatabase } from '~/db/database';
import { migrateDatabase } from '~/db/migrate';

const logger = createLogger('Bot', 'Migrate');
const loaded = loadDatabaseConfig(process.env);

if (!loaded.ok) {
	logger.error(loaded.message);
	process.exit(1);
}

const url = loaded.config.DATABASE_DIRECT_URL;
const db = createDatabase(url);

await migrateDatabase(db);
await db.$client.end();

logger.success(`Migrated ${new URL(url).pathname.slice(1)}.`);
