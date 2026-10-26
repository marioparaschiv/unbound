/**
 * Mints a Discord bot API key: run `bun run bot:mint-key` in `apps/web` with the app's environment.
 * Put the printed key in the bot's environment; the bot sends it as the `x-api-key` header.
 */
// Re-running reuses the `Unbound Bot` user (role `bot`) and mints another key; old keys stay valid.
import { createLogger } from '@unbound-app/logger';

import { mintBotKey } from '~/lib/bot/credential';
import { createAppContext } from '~/lib/context';
import { createDatabase } from '~/db/database';
import { migrateDatabase } from '~/db/migrate';
import { parseEnv } from '~/lib/env';

const logger = createLogger('Web', 'Bot');
const env = parseEnv();

await migrateDatabase(env.DATABASE_DIRECT_URL);

const db = createDatabase(env.DATABASE_URL);
const key = await mintBotKey(createAppContext(env, db));

await db.$client.end();

logger.success('Minted a bot API key. It is shown only once:');
process.stdout.write(`${key}\n`);
