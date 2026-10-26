import { readdirSync, readFileSync } from 'node:fs';
import { createLogger } from '@unbound-app/logger';
import { join } from 'node:path';

import { MIGRATIONS_FOLDER } from '~/db/migrate';
import type { Database } from '~/db/database';

export type HookedTrigger = {
	name: string;
	table: string;
};

const logger = createLogger('Bot', 'Triggers');

const DECLARATION = /CREATE\s+OR\s+REPLACE\s+TRIGGER\s+(\w+)\s[\s\S]*?\sON\s+public\.(\w+)/gi;

/**
 * @description Lists the triggers the bot's migrations install on the web's tables, read from the SQL itself.
 * @param folder The drizzle migrations folder.
 * @returns Each trigger's name and table, in migration order.
 */
export function declaredTriggers(folder: string = MIGRATIONS_FOLDER): HookedTrigger[] {
	const migrations = readdirSync(folder, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.toSorted();

	return migrations.flatMap((migration) =>
		[
			...readFileSync(join(folder, migration, 'migration.sql'), 'utf8').matchAll(DECLARATION),
		].map(([, name = '', table = '']) => ({ name, table })),
	);
}

/**
 * @description Logs one error per declared trigger the web's tables lack, with the fix.
 * @param db The bot's database.
 * @param folder The drizzle migrations folder the expected triggers are read from.
 * @returns The missing triggers.
 */
export async function checkTriggers(
	db: Database,
	folder: string = MIGRATIONS_FOLDER,
): Promise<HookedTrigger[]> {
	const installed = await db.$client<HookedTrigger[]>`
		select trigger.tgname as name, hooked.relname as table
		from pg_trigger as trigger
		join pg_class as hooked on hooked.oid = trigger.tgrelid
		where hooked.relnamespace = 'public'::regnamespace and not trigger.tgisinternal`;
	const present = new Set(installed.map((row) => `${row.table}.${row.name}`));
	const missing = declaredTriggers(folder).filter(
		(trigger) => !present.has(`${trigger.table}.${trigger.name}`),
	);

	// Wake-ups from that table are lost; the timed reconcile still converges, only later.
	for (const { name, table } of missing) {
		logger.error(
			`Trigger ${name} on public.${table} is missing, so its changes reach Discord only on the timed reconcile. Fix: run scripts/provision.sql with phase grant, apply the bot's trigger migration SQL, then run it with -v phase=lock.`,
		);
	}

	return missing;
}

export default { declaredTriggers, checkTriggers };
