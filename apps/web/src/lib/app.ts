import { createAppContext } from '~/lib/context';
import { createDatabase } from '~/db/database';
import { parseEnv } from '~/lib/env';

const env = parseEnv();

/** The process-wide application context. Route handlers import this; tests build their own. */
const app = createAppContext(env, createDatabase(env.DATABASE_URL));

export default app;
