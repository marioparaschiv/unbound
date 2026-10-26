import { createLogger } from '@unbound-app/logger';

import { createDatabase } from '~/db/database';
import { migrateDatabase } from '~/db/migrate';
import { parseDatabaseEnv } from '~/lib/env';

const logger = createLogger('Bot', 'Migrate');
const env = parseDatabaseEnv();
const db = createDatabase(env.DATABASE_DIRECT_URL);

await migrateDatabase(db);
await db.$client.end();

logger.success(`Migrated ${new URL(env.DATABASE_DIRECT_URL).pathname.slice(1)}.`);
