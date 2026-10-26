import { createLogger } from '@unbound-app/logger';

import { migrateDatabase } from '~/db/migrate';
import { parseEnv } from '~/lib/env';

const logger = createLogger('Web', 'Migrate');
const env = parseEnv();

await migrateDatabase(env.DATABASE_DIRECT_URL);
logger.success(`Migrated ${new URL(env.DATABASE_DIRECT_URL).pathname.slice(1)}.`);
