import type { Database } from '~/db/database';

let instance: Database | undefined;

/**
 * @description Hands the open database to the Sapphire pieces, which Sapphire constructs itself.
 * @param db The database `src/index.ts` opened after the config check.
 */
export function setDatabase(db: Database) {
	instance = db;
}

/**
 * @description Returns the database opened at startup.
 * @returns The bot database; throws if called before startup opened it.
 */
export function getDatabase(): Database {
	if (!instance) {
		throw new Error('The database is not open yet.');
	}

	return instance;
}

export default { setDatabase, getDatabase };
