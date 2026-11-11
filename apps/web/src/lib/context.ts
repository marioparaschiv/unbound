import { createJobs, type Jobs } from '~/lib/jobs';
import type { Database } from '~/db/database';
import { createStorage } from '~/lib/storage';
import { createAuth } from '~/lib/auth/auth';
import type { Storage } from '~/lib/storage';
import type { Auth } from '~/lib/auth/auth';
import type { Env } from '~/lib/env';

/** Everything a request handler needs, passed explicitly so tests can build their own. */
export type AppContext = {
	env: Env;
	db: Database;
	auth: Auth;
	storage: Storage;
	now: () => Date;
	/** The process's background jobs, which code that changes their input may kick. */
	jobs: Jobs;
};

/** The context Better Auth's hooks run with: everything but the auth instance they belong to. */
export type AuthHookContext = Omit<AppContext, 'auth'>;

/**
 * @description Wires the auth instance, storage clients, clock and job registry around a database and
 * environment.
 * @param env The validated environment.
 * @param db The open, migrated database.
 * @returns The application context.
 */
export function createAppContext(env: Env, db: Database): AppContext {
	const base: AuthHookContext = {
		env,
		db,
		storage: createStorage(env),
		now: () => new Date(),
		jobs: createJobs(),
	};

	return { ...base, auth: createAuth(base) };
}

export default { createAppContext };
