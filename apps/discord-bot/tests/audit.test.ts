import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Client } from 'discord.js';
import { asc, eq } from 'drizzle-orm';

import type { DispatcherContext } from '~/dispatchers/types';
import { createAuditDispatcher } from '~/dispatchers/audit';
import { auditEvent } from '~/db/schema';

import {
	createTestDatabase,
	DROP_HOOK_TIMEOUT_MS,
	DATABASE_URL,
	type TestDatabase,
} from './helpers/database';
import { createFakeClient, createFakeDiscord, type FakeDiscord } from './helpers/fake-discord';

type EventColumns = Partial<typeof auditEvent.$inferInsert>;

function footers(fake: FakeDiscord) {
	return fake.messages.map((message) => message.embeds[0]?.footer?.text);
}

describe.skipIf(!DATABASE_URL)('audit dispatcher', () => {
	let database: TestDatabase;
	let fake: FakeDiscord;
	let clients: Client<true>[];

	beforeAll(async () => {
		database = await createTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	}, DROP_HOOK_TIMEOUT_MS);

	beforeEach(async () => {
		await database.db.delete(auditEvent);
		fake = createFakeDiscord();
		clients = [];
	});

	afterEach(async () => {
		await Promise.all(clients.map((client) => client.destroy()));
		fake.stop();
	});

	// A fresh client per call stands in for a restarted bot process.
	function context(): DispatcherContext {
		const client = createFakeClient(fake);

		clients.push(client);

		return { db: database.db, client };
	}

	async function seed(id: number, columns: EventColumns = {}) {
		await database.db.insert(auditEvent).values({
			id,
			kind: 'user.unbanned',
			subjectType: 'user',
			subjectId: `user-${id}`,
			actor: { id: 'staff-1', name: 'Mario' },
			data: {},
			reason: null,
			createdAt: new Date('2026-10-01T00:00:00.000Z'),
			...columns,
		});
	}

	function rows() {
		return database.db.select().from(auditEvent).orderBy(asc(auditEvent.id));
	}

	test('posts every event in ascending id order and stores each message id', async () => {
		const audit = createAuditDispatcher(fake.channelId);

		for (const id of [5, 2, 9, 3]) {
			await seed(id);
		}

		await audit.handle('9', context());

		expect(footers(fake)).toEqual([
			'Event #2 · user.unbanned',
			'Event #3 · user.unbanned',
			'Event #5 · user.unbanned',
			'Event #9 · user.unbanned',
		]);
		expect(await rows()).toMatchObject(
			[2, 3, 5, 9].map((id, index) => ({
				id,
				channelId: fake.channelId,
				messageId: fake.messages[index]?.id,
			})),
		);
	});

	test('posts nothing twice across a restart or a crash before the id was stored', async () => {
		const audit = createAuditDispatcher(fake.channelId);

		for (const id of [1, 2, 3]) {
			await seed(id);
		}

		await audit.reconcile(context());
		await audit.reconcile(context());

		expect(fake.requests).toHaveLength(3);

		const [, , third] = fake.messages;

		await database.db
			.update(auditEvent)
			.set({ channelId: null, messageId: null })
			.where(eq(auditEvent.id, 3));
		await seed(4);
		fake.inject(
			{
				id: '901',
				username: 'other-bot',
				discriminator: '0',
				global_name: null,
				avatar: null,
				bot: true,
			},
			{ embeds: [{ footer: { text: 'Event #4 · user.unbanned' } }] },
		);
		await audit.handle('4', context());

		expect(fake.requests).toHaveLength(4);
		expect(fake.requests[3]?.embeds?.[0]?.footer?.text).toBe('Event #4 · user.unbanned');
		expect(await rows()).toMatchObject([
			{ id: 1, messageId: fake.messages[0]?.id },
			{ id: 2, messageId: fake.messages[1]?.id },
			{ id: 3, channelId: fake.channelId, messageId: third?.id },
			{ id: 4, channelId: fake.channelId, messageId: fake.messages[4]?.id },
		]);
	});

	test('a bot post for an older event that reused the id is not adopted', async () => {
		const audit = createAuditDispatcher(fake.channelId);

		fake.inject(fake.botUser, {
			embeds: [
				{
					footer: { text: 'Event #1 · user.unbanned' },
					timestamp: '2020-01-01T00:00:00.000Z',
				},
			],
		});
		await seed(1);
		await audit.reconcile(context());

		expect(fake.requests).toHaveLength(1);
		expect(await rows()).toMatchObject([{ id: 1, messageId: fake.messages[1]?.id }]);
	});

	test('an embed Discord rejects posts a bare fallback so later events still post', async () => {
		const audit = createAuditDispatcher(fake.channelId);

		for (const id of [1, 2, 3]) {
			await seed(id);
		}

		fake.rejectAt([1]);
		await audit.handle('3', context());

		expect(footers(fake)).toEqual([
			'Event #1 · user.unbanned',
			'Event #2 · user.unbanned',
			'Event #3 · user.unbanned',
		]);
		expect(fake.messages[1]?.embeds[0]).toMatchObject({
			title: 'user.unbanned',
			description: 'Discord rejected the full embed for this event; see the admin log.',
		});
		expect((await rows()).map((row) => row.messageId)).toEqual(
			fake.messages.map((message) => message.id),
		);
	});

	test('a burst through 429s posts each event once, in order', async () => {
		const audit = createAuditDispatcher(fake.channelId);
		const ids = Array.from({ length: 30 }, (_, index) => index + 1);

		for (const id of ids.toReversed()) {
			await seed(id);
		}

		fake.rateLimitAt([0, 4, 5, 13, 27]);
		await audit.handle('1', context());

		expect(fake.rateLimited()).toBe(5);
		expect(footers(fake)).toEqual(ids.map((id) => `Event #${id} · user.unbanned`));
		expect((await rows()).map((row) => row.messageId)).toEqual(
			fake.messages.map((message) => message.id),
		);
	});

	test('an unknown kind and a malformed known kind post a generic embed', async () => {
		const audit = createAuditDispatcher(fake.channelId);

		await seed(1, { kind: 'future.thing', data: { colour: 'teal' } });
		await seed(2, { kind: 'user.banned', data: { expiresAt: 42 } });
		await audit.reconcile(context());

		expect(fake.messages.map((message) => message.embeds[0])).toMatchObject([
			{
				title: 'future.thing',
				fields: expect.arrayContaining([
					{ name: 'Data', value: '```json\n{\n  "colour": "teal"\n}\n```' },
				]),
			},
			{
				title: 'user.banned',
				fields: expect.arrayContaining([
					{ name: 'Data', value: '```json\n{\n  "expiresAt": 42\n}\n```' },
				]),
			},
		]);
	});

	test('a note full of mentions can ping no one', async () => {
		const audit = createAuditDispatcher(fake.channelId);
		const body = '@everyone <@123> <@&456> look at this';

		await seed(1, { kind: 'note.added', data: { noteId: 1, body } });
		await audit.handle('1', context());

		const [request] = fake.requests;

		expect(request?.allowed_mentions).toEqual({ parse: [] });
		expect(request?.content).toBeUndefined();
		expect(request?.embeds?.[0]?.description).toBe(body);
		expect(JSON.stringify({ ...request, embeds: undefined })).not.toContain('@everyone');
	});

	test('a failed send stops the run so no later event jumps ahead', async () => {
		const audit = createAuditDispatcher(fake.channelId);

		for (const id of [1, 2, 3]) {
			await seed(id);
		}

		fake.rejectAt([1, 2]);

		const [failed] = await Promise.allSettled([audit.handle('3', context())]);

		expect(failed.status).toBe('rejected');
		expect(fake.requests).toHaveLength(3);
		expect(await rows()).toMatchObject([
			{ id: 1, messageId: fake.messages[0]?.id },
			{ id: 2, messageId: null },
			{ id: 3, messageId: null },
		]);

		await audit.handle('3', context());

		expect(footers(fake)).toEqual([
			'Event #1 · user.unbanned',
			'Event #2 · user.unbanned',
			'Event #3 · user.unbanned',
		]);
	});

	test('an unsendable or missing channel fails the run and posts nothing', async () => {
		const audit = createAuditDispatcher('404');

		await seed(1);

		const [failed] = await Promise.allSettled([audit.reconcile(context())]);

		expect(failed.status).toBe('rejected');
		expect(fake.requests).toEqual([]);
	});
});
