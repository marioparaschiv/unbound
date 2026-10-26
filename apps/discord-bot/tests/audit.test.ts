import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { createStaffNote } from '@unbound-app/web/testing';
import type { AuditEvent } from '@unbound-app/web/bot';
import type { Client } from 'discord.js';
import { asc, eq } from 'drizzle-orm';

import type { DispatcherContext } from '~/dispatchers/types';
import { createAuditDispatcher } from '~/dispatchers/audit';
import { auditPost } from '~/db/schema';

import { createFakeClient, createFakeDiscord, type FakeDiscord } from './helpers/fake-discord';
import { createBotTestDatabase, DATABASE_URL, type BotTestDatabase } from './helpers/database';
import { createFakeReads, EVENT, type FakeReads } from './helpers/fake-reads';
import { signUp } from './helpers/web';

type EventColumns = Partial<AuditEvent>;

function footers(fake: FakeDiscord) {
	return fake.messages.map((message) => message.embeds[0]?.footer?.text);
}

describe.skipIf(!DATABASE_URL)('audit dispatcher', () => {
	let database: BotTestDatabase;
	let fake: FakeDiscord;
	let reads: FakeReads;
	let clients: Client<true>[];

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	});

	beforeEach(async () => {
		await database.db.delete(auditPost);
		fake = createFakeDiscord();
		reads = createFakeReads();
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

		return { db: database.db, web: reads.reads, client };
	}

	function seed(id: number, columns: EventColumns = {}) {
		reads.events.push({
			...EVENT,
			id,
			kind: 'user.unbanned',
			subjectType: 'user',
			subjectId: `user-${id}`,
			subjectName: null,
			...columns,
		});
	}

	async function rows() {
		const posts = await database.db.select().from(auditPost).orderBy(asc(auditPost.eventId));

		return posts.map(({ eventId, channelId, messageId }) => ({
			id: eventId,
			channelId,
			messageId,
		}));
	}

	test('posts every event in ascending id order and stores each message id', async () => {
		const audit = createAuditDispatcher(fake.channelId);

		for (const id of [5, 2, 9, 3]) {
			seed(id);
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
			seed(id);
		}

		await audit.reconcile(context());
		await audit.reconcile(context());

		expect(fake.requests).toHaveLength(3);

		const [, , third] = fake.messages;

		await database.db.delete(auditPost).where(eq(auditPost.eventId, 3));
		seed(4);
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
		seed(1);
		await audit.reconcile(context());

		expect(fake.requests).toHaveLength(1);
		expect(await rows()).toMatchObject([{ id: 1, messageId: fake.messages[1]?.id }]);
	});

	test('an embed Discord rejects posts a bare fallback so later events still post', async () => {
		const audit = createAuditDispatcher(fake.channelId);

		for (const id of [1, 2, 3]) {
			seed(id);
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
			seed(id);
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

		// A kind newer than this bot's contracts arrives as plain text from the database.
		seed(1, { kind: 'future.thing' as AuditEvent['kind'], data: { colour: 'teal' } });
		seed(2, { kind: 'user.banned', data: { expiresAt: 42 } });
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

		seed(1, { kind: 'note.added', data: { noteId: 1, body } });
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
			seed(id);
		}

		fake.rejectAt([1, 2]);

		const [failed] = await Promise.allSettled([audit.handle('3', context())]);

		expect(failed.status).toBe('rejected');
		expect(fake.requests).toHaveLength(3);
		expect(await rows()).toMatchObject([{ id: 1, messageId: fake.messages[0]?.id }]);

		await audit.handle('3', context());

		expect(footers(fake)).toEqual([
			'Event #1 · user.unbanned',
			'Event #2 · user.unbanned',
			'Event #3 · user.unbanned',
		]);
	});

	test('an unsendable or missing channel fails the run and posts nothing', async () => {
		const audit = createAuditDispatcher('404');

		seed(1);

		const [failed] = await Promise.allSettled([audit.reconcile(context())]);

		expect(failed.status).toBe('rejected');
		expect(fake.requests).toEqual([]);
	});

	test('a staff note written on the web posts one embed naming its subject, once', async () => {
		const audit = createAuditDispatcher(fake.channelId);
		const moderator = await signUp(database.web, 'moderator');
		const subject = await signUp(database.web);
		const real = (): DispatcherContext => ({ ...context(), web: database.reads });

		await createStaffNote(database.web, moderator.caller, {
			subject: { type: 'user', id: subject.userId },
			body: 'Watch this account.',
		});
		await audit.handle('any', real());
		await audit.reconcile(real());

		expect(fake.requests).toHaveLength(1);
		expect(fake.messages[0]?.embeds[0]).toMatchObject({
			author: { name: moderator.caller.user.name },
			description: 'Watch this account.',
			fields: expect.arrayContaining([
				expect.objectContaining({
					name: 'Subject',
					value: expect.stringContaining(subject.caller.user.name),
				}),
			]),
		});
	});
});
