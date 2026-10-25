/**
 * Mints an API key for the Discord bot: `bun run bot:mint-key` from `apps/web`, with the app's
 * environment. It migrates the database, finds or creates the `Unbound Bot` user with the `bot` role,
 * and prints a new key once. The bot sends it as the `x-api-key` header value, so put it in the bot's
 * environment. Re-running reuses the user and mints another key; earlier keys stay valid.
 */
import { createLogger } from '@unbound-app/logger';

import { createAppContext } from '~/lib/context';
import { mintBotKey } from '~/lib/bot/credential';
import { createDatabase } from '~/db/database';
import { migrateDatabase } from '~/db/migrate';
import { parseEnv } from '~/lib/env';

const logger = createLogger('Web', 'Bot');
const env = parseEnv();
const db = createDatabase(env.DATABASE_PATH);

migrateDatabase(db);

const key = await mintBotKey(createAppContext(env, db));

logger.success('Minted a bot API key. It is shown only once:');
process.stdout.write(`${key}\n`);
