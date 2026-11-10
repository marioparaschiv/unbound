import { afterAll, describe, expect, test } from 'bun:test';
import type { AuditEvent } from '@unbound-app/web/bot';

import { createEventCursor, type CursorTable } from '~/lib/event-cursor';
import type { DispatcherContext } from '~/dispatchers/types';
import { createDatabase } from '~/db/database';

import { createFakeReads, EVENT, type FakeReads } from '../helpers/fake-reads';

// The cursor hands the database only to its table, which here is in memory, so it never connects.
const db = createDatabase('postgres://unused@127.0.0.1:1/unused');

type MemoryTable = CursorTable & { rows: Map<number, 'floor' | 'handled'> };

function memoryTable(): MemoryTable {
	const rows = new Map<number, 'floor' | 'handled'>();

	return {
		rows,
		last: async () => (rows.size ? Math.max(...rows.keys()) : undefined),
		async floor(_db, eventId) {
			rows.set(eventId, 'floor');
		},
	};
}

function seed(fake: FakeReads, ids: number[]) {
	fake.events.push(...ids.map((id): AuditEvent => ({ ...EVENT, id })));
}

describe('createEventCursor', () => {
	afterAll(async () => {
		await db.$client.end();
	});

	function setup() {
		const fake = createFakeReads();
		const table = memoryTable();
		const cursor = createEventCursor({
			table,
			after: (web, eventId, limit) => web.eventsAfter(eventId, limit),
		});
		const context: DispatcherContext = { db, web: fake.reads };
		const pages: number[][] = [];

		function drain(fail?: number) {
			return cursor.drain(context, async (page) => {
				pages.push(page.map((event) => event.id));

				for (const event of page) {
					if (event.id === fail) {
						throw new Error(`Discord rejected event ${event.id}`);
					}

					table.rows.set(event.id, 'handled');
				}
			});
		}

		return { fake, table, pages, drain };
	}

	test('an empty table floors at the newest event and hands over no history', async () => {
		const { fake, table, pages, drain } = setup();

		seed(fake, [1, 2, 3]);
		await drain();

		expect(pages).toEqual([]);
		expect([...table.rows]).toEqual([[3, 'floor']]);

		seed(fake, [4]);
		await drain();

		expect(pages).toEqual([[4]]);
	});

	test('an empty stream floors at 0, so its first event is handed over', async () => {
		const { fake, table, pages, drain } = setup();

		await drain();
		seed(fake, [1]);
		await drain();

		expect(table.rows.get(0)).toBe('floor');
		expect(pages).toEqual([[1]]);
	});

	test('pages through a backlog in id order, each event once', async () => {
		const { fake, pages, drain } = setup();

		await drain();
		seed(
			fake,
			Array.from({ length: 250 }, (_, index) => 250 - index),
		);
		await drain();

		expect(pages.map((page) => page.length)).toEqual([100, 100, 50]);
		expect(pages.flat()).toEqual(Array.from({ length: 250 }, (_, index) => index + 1));
	});

	test('a failed event ends the run there, and the next run resumes at it', async () => {
		const { fake, pages, drain } = setup();

		await drain();
		seed(fake, [1, 2, 3]);

		expect(
			await drain(2).then(
				() => 'drained',
				(error: Error) => error.message,
			),
		).toBe('Discord rejected event 2');

		await drain();

		expect(pages).toEqual([
			[1, 2, 3],
			[2, 3],
		]);
	});
});
