import { afterEach, describe, expect, test } from 'bun:test';
import { Database as Sqlite } from 'bun:sqlite';
import { asc, eq, sql } from 'drizzle-orm';
import { join } from 'node:path';

import {
	addon,
	botFeedChange,
	moderationEvent,
	staffNote,
	submission,
	submissionSource,
	syncDocument,
	user,
} from '~/db/schema';
import { createDatabase } from '~/db/database';
import type { Database } from '~/db/database';

import type { TableReport } from '../scripts/copy-sqlite/copy';
import type { SqliteSource } from './helpers/sqlite-source';
import type { TestDatabase } from './helpers/database';

import {
	createSqliteSource,
	DETAILS_JSON,
	DOCUMENT_JSON,
	EVENT_SEQUENCE,
	FEED_SEQ,
	INT64_MAX,
	MANIFEST_JSON,
	MAX_SAFE_ID,
	REPOSITORY_ID,
} from './helpers/sqlite-source';
import { copySqlite, TargetNotEmptyError, VerificationError } from '../scripts/copy-sqlite/copy';
import { tables } from '../scripts/copy-sqlite/registry';
import { createTestDatabase } from './helpers/database';
import { codecs } from '../scripts/copy-sqlite/codecs';

type Snapshot = Record<string, string>;

type Setup = {
	source: SqliteSource;
	target: TestDatabase;
	db: Database;
};

type CountRow = {
	n: number;
};

type FeedRow = {
	feed: string;
	key: string;
	seq: bigint;
	changed_at: bigint;
};

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
	for (const cleanup of cleanups.splice(0)) {
		await cleanup();
	}
});

async function setup(): Promise<Setup> {
	const source = createSqliteSource();
	const target = await createTestDatabase();
	const db = createDatabase(target.url);

	cleanups.push(source.remove, target.drop, () => db.$client.end());

	return { source, target, db };
}

function copy({ source, target }: Setup, replace: boolean = false) {
	return copySqlite({ sqlitePath: source.path, targetUrl: target.url, replace });
}

// Every row of every app table, as Postgres prints it, to tell whether a run changed anything.
async function snapshot(db: Database): Promise<Snapshot> {
	const entries = await Promise.all(
		tables.map(async ({ name }) => {
			const [row] = await db.$client.unsafe(
				`SELECT count(*) || ':' || md5(coalesce(string_agg(t::text, E'\\n' ORDER BY t::text), '')) AS digest FROM "${name}" t`,
			);

			return [name, String(row?.digest)] as const;
		}),
	);

	return Object.fromEntries(entries);
}

function sourceCount(source: SqliteSource, table: string): number {
	const db = new Sqlite(source.path, { readonly: true });
	const row = db.query<CountRow, []>(`SELECT count(*) AS n FROM "${table}"`).get();

	db.close();

	return row?.n ?? 0;
}

async function failure(promise: Promise<TableReport[]>): Promise<Error> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof Error) {
			return error;
		}
	}

	throw new Error('Expected the copy to fail.');
}

describe('copySqlite', () => {
	test('copies every table and verifies each against the source', async () => {
		const context = await setup();
		const reports = await copy(context);

		expect(reports.map((report) => report.table).toSorted()).toEqual(
			tables.map((table) => table.name).toSorted(),
		);

		for (const report of reports) {
			const [row] = await context.db.$client.unsafe(
				`SELECT count(*)::int AS n FROM "${report.table}"`,
			);

			expect(report).toMatchObject({ match: true, present: true });
			expect(report.rows).toBe(sourceCount(context.source, report.table));
			expect(row?.n).toBe(report.rows);
		}

		expect(reports.every((report) => report.rows > 0)).toBe(true);
	});

	test('reads every column type back exactly through the app schema', async () => {
		const context = await setup();
		const { db } = context;

		await copy(context);

		const users = await db.select().from(user).orderBy(asc(user.id));

		expect(users.map((row) => [row.id, row.emailVerified, row.banned])).toEqual([
			['u1', true, false],
			['u2', false, true],
			['u3', false, null],
		]);
		expect(users[0]?.createdAt.getTime()).toBe(1_700_000_000_123);
		expect(users[0]?.name).toBe('Zoë 😀');
		expect(users[0]?.banExpires).toBeNull();
		expect(users[1]?.banExpires?.getTime()).toBe(4_102_444_800_000);
		expect(users[2]?.createdAt.getTime()).toBe(0);
		expect(users[2]?.updatedAt.getTime()).toBe(-1);

		const addons = await db.select().from(addon).orderBy(asc(addon.id));

		expect(addons.map((row) => row.pinnedFields)).toEqual([2_147_483_647, -2_147_483_648]);
		expect(addons.map((row) => row.delistedAt?.getTime() ?? null)).toEqual([
			null,
			1_700_000_005_000,
		]);

		const [listing] = await db.select().from(submission);

		expect(listing?.manifest).toEqual(JSON.parse(MANIFEST_JSON));
		expect(Object.keys(listing?.manifest ?? {})).toEqual([
			'version',
			'name',
			'id',
			'authors',
			'z',
		]);

		const [source] = await db.select().from(submissionSource);

		expect(source?.repositoryId).toBe(REPOSITORY_ID);
		expect(source?.changelog).toBeNull();

		const [raw] = await db.$client`
			select
				(select manifest::text from submission) as manifest,
				(select details::text from submission_source) as details,
				(select document::text from sync_document) as document,
				(select last_request::text from rate_limit) as last_request`;

		expect(raw).toEqual({
			manifest: MANIFEST_JSON,
			details: DETAILS_JSON,
			document: DOCUMENT_JSON,
			last_request: INT64_MAX,
		});
		expect((await db.select().from(syncDocument))[0]?.revision).toBe(3);

		const events = await db.select({ id: moderationEvent.id }).from(moderationEvent);

		expect(events.map((row) => row.id).toSorted((a, b) => a - b)).toEqual([9, 40]);
		expect((await db.select().from(staffNote))[0]?.id).toBe(MAX_SAFE_ID);
	});

	test('keeps bot feed changes as the source has them', async () => {
		const context = await setup();
		const sqlite = new Sqlite(context.source.path, { readonly: true, safeIntegers: true });
		const expected = sqlite
			.query<FeedRow, []>(
				'SELECT feed, key, seq, changed_at FROM bot_feed_change ORDER BY feed, key',
			)
			.all()
			.map((row) => [row.feed, row.key, Number(row.seq), Number(row.changed_at)]);

		sqlite.close();
		await copy(context);

		const rows = await context.db
			.select()
			.from(botFeedChange)
			.orderBy(asc(botFeedChange.feed), asc(botFeedChange.key));

		expect(expected.length).toBeGreaterThan(1);
		expect(rows.map((row) => [row.feed, row.key, row.seq, row.changedAt.getTime()])).toEqual(
			expected,
		);
	});

	test('refuses a target with rows and leaves it unchanged', async () => {
		const context = await setup();

		await copy(context);

		const before = await snapshot(context.db);
		const error = await failure(copy(context));

		expect(error).toBeInstanceOf(TargetNotEmptyError);
		expect(await snapshot(context.db)).toEqual(before);
	});

	test('replaces a changed target with an identical copy', async () => {
		const context = await setup();
		const first = await copy(context);
		const copied = await snapshot(context.db);

		await context.db.delete(staffNote);
		await context.db.update(addon).set({ name: 'Changed' }).where(eq(addon.id, 'acme.one'));

		expect(await snapshot(context.db)).not.toEqual(copied);
		expect(await copy(context, true)).toEqual(first);
		expect(await snapshot(context.db)).toEqual(copied);
	});

	test('rolls back when a table reads back different from the source', async () => {
		const context = await setup();
		// A timestamp codec that writes one millisecond late, on one column only.
		const specs = tables.map((table) => ({
			...table,
			columns: table.columns.map((column) =>
				table.name === 'addon' && column.name === 'updated_at'
					? {
							...column,
							codec: {
								...column.codec,
								encode: (value: string) =>
									codecs.PgTimestamp.encode(String(BigInt(value) + 1n)),
							},
						}
					: column,
			),
		}));
		const error = await failure(
			copySqlite({ sqlitePath: context.source.path, targetUrl: context.target.url, specs }),
		);

		expect(error).toBeInstanceOf(VerificationError);
		expect(
			(error as VerificationError).reports
				.filter((report) => !report.match)
				.map((report) => report.table),
		).toEqual(['addon']);
		expect(
			Object.values(await snapshot(context.db)).every((digest) => digest.startsWith('0:')),
		).toBe(true);
	});

	test('fails on a source column or table the schema does not know', async () => {
		const context = await setup();

		context.source.exec('ALTER TABLE addon ADD COLUMN extra text');
		expect((await failure(copy(context))).message).toContain('addon.extra');

		context.source.exec('ALTER TABLE addon DROP COLUMN extra');
		context.source.exec('CREATE TABLE stray (id integer primary key)');
		expect((await failure(copy(context))).message).toContain('stray');
	});

	test('names the row holding NUL, without its value, before writing anything', async () => {
		const cases = [
			{
				statement: `UPDATE addon_maintainer SET role = 'hidden' || char(0) || 'value'`,
				location: 'addon_maintainer.role at (addon_id, user_id) = ("acme.one", "u1"):',
			},
			{
				statement: `UPDATE submission SET manifest = '{"hidden":"a\\u0000value"}'`,
				location: 'submission.manifest at (id) = ("sub1"):',
			},
		];

		for (const { statement, location } of cases) {
			const context = await setup();

			context.source.exec(statement);

			const error = await failure(copy(context));
			const cause = error.cause instanceof Error ? error.cause.message : '';
			const [target] = await context.db.$client`select to_regclass('addon') as addon`;

			expect(error.message).toBe(location);
			expect(cause).toContain('NUL');
			expect(`${error.message} ${cause}`).not.toMatch(/hidden|value/);
			expect(target?.addon).toBeNull();
		}
	});

	test('copies a table the source predates as empty', async () => {
		const context = await setup();

		context.source.exec('DROP TABLE discord_profile');

		const reports = await copy(context);

		expect(reports.find((report) => report.table === 'discord_profile')).toMatchObject({
			present: false,
			rows: 0,
			match: true,
		});
	});

	test('continues every sequence past the copied ids, with triggers back on', async () => {
		const context = await setup();
		const { db } = context;

		await copy(context);

		const [event] = await db
			.insert(moderationEvent)
			.values({
				subjectType: 'addon',
				subjectId: 'acme.one',
				kind: 'addon.delisted',
				data: {},
				createdAt: new Date(),
			})
			.returning({ id: moderationEvent.id });
		const [note] = await db
			.insert(staffNote)
			.values({ addonId: 'acme.one', body: 'after', createdAt: new Date() })
			.returning({ id: staffNote.id });

		expect(event?.id).toBe(EVENT_SEQUENCE + 1);
		expect(note?.id).toBe(MAX_SAFE_ID + 1);

		await db.insert(addon).values({
			id: 'acme.three',
			type: 'plugin',
			name: 'Three',
			description: 'Third',
			updatedAt: new Date(),
		});

		const [change] = await db
			.select({ seq: botFeedChange.seq })
			.from(botFeedChange)
			.where(sql`${botFeedChange.key} = 'acme.three'`);

		expect(change?.seq).toBe(FEED_SEQ + 1);
	});
});

describe('db:copy-sqlite', () => {
	test('copies, then refuses a second run without --replace', async () => {
		const context = await setup();

		function run(...args: string[]) {
			return Bun.spawnSync(['bun', 'scripts/copy-sqlite.ts', context.source.path, ...args], {
				cwd: join(import.meta.dirname, '..'),
				env: { ...process.env, DATABASE_DIRECT_URL: context.target.url },
			});
		}

		const first = run();

		expect(first.exitCode).toBe(0);
		expect(first.stdout.toString()).toMatch(/^sync_document\s+1\s+[0-9a-f]{64}\s+match$/m);
		expect(run().exitCode).toBe(1);
		expect(run('--replace').exitCode).toBe(0);
	});
});
