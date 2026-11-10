import { createAppContext, type AppContext } from '~/lib/context';
import { createDatabase } from '~/db/database';
import { parseEnv } from '~/lib/env';

let app: AppContext | undefined;

/**
 * @description Returns the process-wide application context, built on first use so importing a route
 * parses no env and opens no database. Route handlers call this; tests build their own.
 * @returns The application context.
 */
export function getApp(): AppContext {
	if (!app) {
		const env = parseEnv();

		app = createAppContext(env, createDatabase(env.DATABASE_URL));
	}

	return app;
}

export default { getApp };
