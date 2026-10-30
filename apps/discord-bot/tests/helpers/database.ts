import { createTestContext, MAINTENANCE_URL, type AppContext } from '@unbound-app/web/testing';
import { createBotReads, type BotReads } from '@unbound-app/web/bot';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';

import { createDatabase, type Database } from '~/db/database';
import { NOTIFY_CHANNELS } from '~/dispatchers/types';
import { migrateDatabase } from '~/db/migrate';
import { SITE_URL } from '~/lib/constants';

export type BotTestDatabase = {
	/** The web's context over the same database, for seeding web rows through the web's own helpers. */
	web: AppContext;
	/** The bot's schema, migrated. */
	db: Database;
	/** The read model over the bot's pool, as the runtime builds it. */
	reads: BotReads;
	/** The direct url of the throwaway database. */
	url: string;
	drop: () => Promise<void>;
};

export type Notification = { channel: string; payload: string };

export type NotificationLog = {
	received: Notification[];
	/** Resolves once every notification committed before the call has arrived. */
	flush: () => Promise<void>;
	stop: () => Promise<void>;
};

const FLUSH_CHANNEL = 'test_flush';

/** The sponsor grace period the test read model judges standing with, the web's default. */
export const TEST_GRACE_DAYS = 7;

/** A direct url on the test cluster, from the web's helper; unset skips the database suites. */
export const DATABASE_URL = MAINTENANCE_URL;

/**
 * @description Creates a throwaway database with the web's migrations, then the bot's: schema `bot`
 * and the triggers on the web's tables.
 * @returns The web's context, the bot's database and reads over it, its url and `drop()`.
 */
export async function createBotTestDatabase(): Promise<BotTestDatabase> {
	const { ctx: web, close } = await createTestContext();
	const url = web.env.DATABASE_DIRECT_URL;
	const db = createDatabase(url);

	try {
		await migrateDatabase(db);
	} catch (error) {
		await db.$client.end();
		await close();

		throw error;
	}

	return {
		web,
		db,
		reads: createBotReads(db.$client, { siteUrl: SITE_URL, sponsorGraceDays: TEST_GRACE_DAYS }),
		url,
		async drop() {
			await db.$client.end();
			await close();
		},
	};
}

/**
 * @description Records every notification on the bot's channels from a dedicated connection.
 * @param database The test database to listen on.
 * @returns The received notifications, a `flush()` barrier and `stop()`.
 */
export async function recordNotifications(
	database: Pick<BotTestDatabase, 'url' | 'db'>,
): Promise<NotificationLog> {
	const sql = postgres(database.url, { max: 1, onnotice: () => void 0 });
	const received: Notification[] = [];
	const flushed = new Set<string>();

	for (const channel of NOTIFY_CHANNELS) {
		await sql.listen(channel, (payload) => {
			received.push({ channel, payload });
		});
	}

	await sql.listen(FLUSH_CHANNEL, (payload) => {
		flushed.add(payload);
	});

	return {
		received,
		// Postgres delivers notifications in commit order, so the barrier arrives after all earlier ones.
		async flush() {
			const token = randomBytes(6).toString('hex');

			await database.db.$client`SELECT pg_notify(${FLUSH_CHANNEL}, ${token})`;
			await waitFor(() => flushed.has(token));
		},
		async stop() {
			await sql.end();
		},
	};
}

/**
 * @description Polls a condition until it holds.
 * @param condition The condition to wait for.
 * @param timeoutMs How long to wait before failing.
 * @returns Resolves once the condition holds; rejects on timeout.
 */
export async function waitFor(
	condition: () => boolean | Promise<boolean>,
	timeoutMs: number = 10_000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (!(await condition())) {
		if (Date.now() > deadline) {
			throw new Error(`Condition not met within ${timeoutMs}ms.`);
		}

		await Bun.sleep(20);
	}
}
