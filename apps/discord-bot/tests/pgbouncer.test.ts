import { manifest, schema, seedApprovedAddon, signInWithDiscord } from '@unbound-app/web/testing';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createBotReads, type BotReads } from '@unbound-app/web/bot';
import { eq } from 'drizzle-orm';

import { createDatabase, POOLED_OPTIONS, type Database } from '~/db/database';
import { addonMessage } from '~/db/schema';
import { listen } from '~/runtime/listen';

import {
	createBotTestDatabase,
	DATABASE_URL,
	TEST_GRACE_DAYS,
	waitFor,
	type BotTestDatabase,
} from './helpers/database';
import { startPgbouncer, PGBOUNCER, type Pgbouncer } from './helpers/pgbouncer';

// Fewer server connections than client connections, so statements move between them.
const POOL_SIZE = 2;
const REPLAYS = 5;

describe.skipIf(!DATABASE_URL || !PGBOUNCER)('pooled database behind pgbouncer', () => {
	let database: BotTestDatabase;
	let bouncer: Pgbouncer;
	let pooled: Database;
	let reads: BotReads;

	beforeAll(async () => {
		database = await createBotTestDatabase();
		bouncer = await startPgbouncer(database.url, POOL_SIZE);
		pooled = createDatabase(bouncer.url, POOLED_OPTIONS);
		reads = createBotReads(pooled.$client, {
			siteUrl: 'https://unbound.rip',
			sponsorGraceDays: TEST_GRACE_DAYS,
		});

		const { userId } = await signInWithDiscord(database.web, {
			id: '800',
			name: 'Pooled',
			email: 'pooled@example.com',
		});

		await seedApprovedAddon(database.web, userId, manifest('pooled.addon'));
	});

	afterAll(async () => {
		await pooled.$client.end();
		await bouncer.stop();
		await database.drop();
	});

	test('reads the web and writes the bot schema at once through transaction pooling', async () => {
		async function round(index: number) {
			const [addon, members] = await Promise.all([
				reads.addon('pooled.addon'),
				reads.members({ by: 'discord', ids: ['800'] }),
				reads.eventsAfter(0, 10),
				reads.releasesSince(new Date(0)),
			]);

			await pooled
				.insert(addonMessage)
				.values({
					addonId: 'pooled.addon',
					channelId: '1',
					messageId: String(index),
					postedHash: '',
				})
				.onConflictDoUpdate({
					target: addonMessage.addonId,
					set: { messageId: String(index) },
				});

			return [addon?.version, members.map((member) => member.isAddonDeveloper)];
		}

		const results = await Promise.all(
			Array.from({ length: REPLAYS }, (_, index) => round(index)),
		);

		expect(results).toEqual(Array.from({ length: REPLAYS }, () => ['1.0.0', [true]]));
		expect(await pooled.select().from(addonMessage)).toHaveLength(1);
	});

	test('a dispatcher listener on the direct url receives notifies from web writes through pgbouncer', async () => {
		const payloads: string[] = [];
		const subscribed = Promise.withResolvers<void>();
		const unlisten = listen({
			url: database.url,
			channel: 'addon_changed',
			handler: async (payload) => void payloads.push(payload),
			reconcile: async () => subscribed.resolve(),
		});

		try {
			await subscribed.promise;
			await pooled.$client`update addon set name = 'Pooled' where id = 'pooled.addon'`;
			await waitFor(() => payloads.includes('pooled.addon'));
		} finally {
			await unlisten();
		}

		const [row] = await database.web.db
			.select({ name: schema.addon.name })
			.from(schema.addon)
			.where(eq(schema.addon.id, 'pooled.addon'));

		expect(row?.name).toBe('Pooled');
	});
});
