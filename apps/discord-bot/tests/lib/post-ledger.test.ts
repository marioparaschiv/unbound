import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { DiscordAPIError, RESTJSONErrorCodes, type APIMessage } from 'discord.js';

import {
	createPostLedger,
	type DesiredPost,
	type LedgerRow,
	type MutableRows,
	type PostLedgerOptions,
} from '~/lib/post-ledger';
import { createDatabase } from '~/db/database';

import { createFakeDiscord, type FakeDiscord } from '../helpers/fake-discord-rest';

// The ledger hands the database only to its rows, which here are in memory, so it never connects.
const db = createDatabase('postgres://unused@127.0.0.1:1/unused');

type MemoryRows = MutableRows & { rows: Map<string, LedgerRow>; failInsert: boolean };

function memoryRows(): MemoryRows {
	const rows = new Map<string, LedgerRow>();
	const table: MemoryRows = {
		rows,
		failInsert: false,
		list: async () => new Map(rows),
		get: async (_db, key) => rows.get(key),
		async insert(_db, key, row) {
			if (table.failInsert) {
				throw new Error(`Failed to write row ${key}`);
			}

			rows.set(key, row);
		},
		async update(_db, key, row) {
			rows.set(key, row);
		},
		async remove(_db, key) {
			rows.delete(key);
		},
	};

	return table;
}

function desired(text: string, channelId = '1', hash = text): DesiredPost {
	return { channelId, hash, render: async () => ({ body: { content: text } }) };
}

function rejectedEdit() {
	const code = RESTJSONErrorCodes.InvalidFormBodyOrContentType;

	return new DiscordAPIError(
		{ code, message: 'Invalid Form Body' },
		code,
		400,
		'PATCH',
		'/x',
		{},
	);
}

// A claim by content: `key@channel` names the subject and the channel its post belongs in.
function claimByContent(message: APIMessage) {
	const [key, channelId] = message.content.split('@');

	return key ? { key, channelId } : undefined;
}

function outcome<T>(run: Promise<T>) {
	return run.then(
		() => 'resolved',
		(error: Error) => error.message,
	);
}

describe('createPostLedger', () => {
	let discord: FakeDiscord;
	let table: MemoryRows;

	beforeEach(() => {
		discord = createFakeDiscord();
		table = memoryRows();
	});

	afterEach(async () => {
		await discord.stop();
	});

	afterAll(async () => {
		await db.$client.end();
	});

	function ledger(policy: PostLedgerOptions['policy'], messages = discord.gateway) {
		return createPostLedger({ messages, label: 'subject', policy, rows: table });
	}

	function methods() {
		return discord.requests.map((request) => request.method);
	}

	describe('append-only', () => {
		test('posts once and never edits, deletes or reposts, even once the post is gone', async () => {
			const posts = ledger('append-only');

			await posts.sync(db, 'a', desired('first'));
			await posts.sync(db, 'a', desired('second'));
			await posts.sync(db, 'a', undefined);

			const [message] = discord.messages('1');

			expect(message?.content).toBe('first');
			expect(table.rows.get('a')?.messageId).toBe(message?.id);

			discord.handDelete('1', message?.id ?? '');
			await posts.sync(db, 'a', desired('third'));

			expect(methods()).toEqual(['POST']);
		});

		test('adopts only claimed posts of keys without a row and deletes nothing', async () => {
			const posts = ledger('append-only');

			await posts.sync(db, 'a', desired('a@1'));

			const lost = discord.seed('1', discord.selfId, { content: 'b@1' });

			discord.seed('1', discord.selfId, { content: 'a@1' });
			discord.seed('1', discord.selfId, { content: 'b@1' });
			discord.seed('1', discord.selfId, { content: 'c@2' });
			discord.seed('1', discord.selfId, { content: '' });

			const { recorded } = await posts.adopt(db, ['1'], claimByContent);

			expect([...recorded].sort()).toEqual(['a', 'b']);
			expect(table.rows.get('b')).toEqual({ channelId: '1', messageId: lost, hash: '' });
			expect(methods()).not.toContain('DELETE');
			expect(discord.messages('1')).toHaveLength(6);
		});

		test('a failed adoption ends the run, so the post is never announced twice', async () => {
			const posts = ledger('append-only');

			discord.seed('1', discord.selfId, { content: 'a@1' });
			table.failInsert = true;

			expect(await outcome(posts.adopt(db, ['1'], claimByContent))).toBe(
				'Failed to write row a',
			);
		});

		test('a failed row write keeps the post for adoption', async () => {
			const posts = ledger('append-only');

			table.failInsert = true;
			expect(await outcome(posts.sync(db, 'a', desired('a@1')))).toBe(
				'Failed to write row a',
			);

			expect(discord.messages('1')).toHaveLength(1);
			expect(methods()).not.toContain('DELETE');
		});
	});

	describe('mutable', () => {
		test('a changed hash edits the post in place; the same hash writes nothing', async () => {
			const posts = ledger('mutable');

			await posts.sync(db, 'a', desired('first'));
			await posts.sync(db, 'a', desired('second'));
			await posts.sync(db, 'a', desired('second'));

			const [message, ...extra] = discord.messages('1');

			expect(extra).toHaveLength(0);
			expect(message?.content).toBe('second');
			expect(table.rows.get('a')).toEqual({
				channelId: '1',
				messageId: message?.id ?? '',
				hash: 'second',
			});
			expect(methods()).toEqual(['POST', 'GET', 'PATCH', 'GET']);
		});

		test('an edit Discord rejects replaces the post, and the row follows it', async () => {
			await ledger('mutable').sync(db, 'a', desired('first'));

			const [old] = discord.messages('1');
			const posts = ledger('mutable', {
				...discord.gateway,
				edit: () => Promise.reject(rejectedEdit()),
			});

			await posts.sync(db, 'a', desired('second'));

			const [message, ...extra] = discord.messages('1');

			expect(extra).toHaveLength(0);
			expect(message?.id).not.toBe(old?.id);
			expect(message?.content).toBe('second');
			expect(table.rows.get('a')?.messageId).toBe(message?.id);
		});

		test('a move reposts in the new channel; an undesired post goes with its row', async () => {
			const posts = ledger('mutable');

			await posts.sync(db, 'a', desired('first'));
			await posts.sync(db, 'a', desired('first', '2'));

			expect(discord.messages('1')).toHaveLength(0);
			expect(discord.messages('2')).toHaveLength(1);

			await posts.sync(db, 'a', undefined);

			expect(discord.messages('2')).toHaveLength(0);
			expect(table.rows.has('a')).toBe(false);
		});

		test('a failed row write deletes the post it just made', async () => {
			const posts = ledger('mutable');

			table.failInsert = true;
			expect(await outcome(posts.sync(db, 'a', desired('first')))).toBe(
				'Failed to write row a',
			);

			expect(discord.messages('1')).toHaveLength(0);
		});

		test('adoption deletes duplicate and misplaced posts and adopts one whose row lost its message', async () => {
			const posts = ledger('mutable');

			await posts.sync(db, 'a', desired('a@1'));
			await posts.sync(db, 'b', desired('b@1'));

			const [kept = '', gone = ''] = discord.messages('1').map((message) => message.id);

			discord.handDelete('1', gone);

			const duplicate = discord.seed('1', discord.selfId, { content: 'a@1' });
			const misplaced = discord.seed('1', discord.selfId, { content: 'a@2' });
			const orphan = discord.seed('1', discord.selfId, { content: 'b@1' });
			const other = discord.seed('1', '42', { content: 'b@1' });
			const { present } = await posts.adopt(db, ['1'], claimByContent);

			expect(discord.messages('1').map((message) => message.id)).toEqual([
				kept,
				orphan,
				other,
			]);
			expect([...present]).toEqual([kept, duplicate, misplaced, orphan]);
			expect(table.rows.get('b')).toEqual({ channelId: '1', messageId: orphan, hash: '' });

			await posts.sync(db, 'b', desired('b@1'), present);

			expect(discord.messages('1').find((message) => message.id === orphan)?.content).toBe(
				'b@1',
			);
			expect(table.rows.get('b')?.hash).toBe('b@1');
		});
	});
});
