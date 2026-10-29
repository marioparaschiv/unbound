import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { Database as Sqlite } from 'bun:sqlite';
import { asc, eq } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	addon,
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
	INT64_MAX,
	MANIFEST_JSON,
	MAX_SAFE_ID,
	REPOSITORY_ID,
} from './helpers/sqlite-source';
import { copySqlite, TargetNotEmptyError, VerificationError } from '../scripts/copy-sqlite/copy';
import { codecs, postgresDoubleText } from '../scripts/copy-sqlite/codecs';
import { tables } from '../scripts/copy-sqlite/registry';
import { createTestDatabase } from './helpers/database';

type Snapshot = Record<string, string>;

type Setup = {
	source: SqliteSource;
	target: TestDatabase;
	db: Database;
};

type CountRow = {
	n: number;
};

type NameRow = {
	name: string;
};

type RegclassRow = {
	table: string | null;
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

function sourceTables(source: SqliteSource): Set<string> {
	const db = new Sqlite(source.path, { readonly: true });
	const rows = db.query<NameRow, []>("SELECT name FROM sqlite_master WHERE type = 'table'").all();

	db.close();

	return new Set(rows.map((row) => row.name));
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
		const sourceNames = sourceTables(context.source);

		expect(reports.map((report) => report.table).toSorted()).toEqual(
			tables.map((table) => table.name).toSorted(),
		);

		for (const report of reports) {
			const [row] = await context.db.$client.unsafe(
				`SELECT count(*)::int AS n FROM "${report.table}"`,
			);
			const present = sourceNames.has(report.table);

			expect(report).toMatchObject({ match: true, present });
			expect(report.rows).toBe(present ? sourceCount(context.source, report.table) : 0);
			expect(row?.n).toBe(report.rows);
			expect(report.targetRows).toBe(report.rows);
			expect(report.targetChecksum).toBe(report.checksum);
		}

		expect(reports.every((report) => report.rows > 0 || !sourceNames.has(report.table))).toBe(
			true,
		);
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
		expect(users[2]?.name).toBe('\uFEFFNulls');
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

	test('skips the retired bot feed and copies every other table', async () => {
		const context = await setup();
		const reports = await copy(context);
		const [row] = await context.db.$client<
			RegclassRow[]
		>`select to_regclass('bot_feed_change')::text as "table"`;

		expect(sourceCount(context.source, 'bot_feed_change')).toBeGreaterThan(1);
		expect(reports.map((report) => report.table)).not.toContain('bot_feed_change');
		expect(reports.every((report) => report.match)).toBe(true);
		expect(row?.table).toBeNull();
	});

	test('copies past the retired bot feed but fails on any other unknown table', async () => {
		const context = await setup();

		expect((await copy(context)).every((report) => report.match)).toBe(true);

		context.source.exec('CREATE TABLE bot_feed_cursor (feed text primary key)');

		const error = await failure(copy(context, true));

		expect(error.message).toContain('bot_feed_cursor');
	});

	test('formats doubles exactly as Postgres prints them', async () => {
		const { db } = await setup();
		const values = [
			0,
			-0,
			1,
			-1,
			0.1,
			0.30000000000000004,
			1.5,
			12.25,
			1e-4,
			9.9e-5,
			1e-7,
			123456789012345,
			1e15,
			1e16,
			1.7976931348623157e308,
			5e-324,
			-2.5e-10,
			Number.NaN,
			Infinity,
			-Infinity,
		];
		const inputs = values.map((value) => (Object.is(value, -0) ? '-0' : String(value)));
		const rows = await db.$client<{ text: string }[]>`
			select value::float8::text as text from unnest(${inputs}::text[]) with ordinality as input(value, position) order by position`;

		expect(rows.map((row) => row.text)).toEqual(values.map(postgresDoubleText));
	});

	test('copies timestamps from year 1 to year 9999 and names the row of one past them', async () => {
		const first = Date.parse('0001-01-01T00:00:00.000Z');
		const last = Date.parse('9999-12-31T23:59:59.999Z');
		const context = await setup();

		context.source.exec(`UPDATE addon SET updated_at = ${first} WHERE id = 'acme.one'`);
		context.source.exec(`UPDATE addon SET updated_at = ${last} WHERE id = 'acme.two'`);
		await copy(context);

		const rows = await context.db.$client`
			select (extract(epoch from updated_at) * 1000)::bigint::text as ms from addon order by id`;

		expect(rows.map((row) => Number(row.ms))).toEqual([first, last]);

		for (const outside of [first - 1, last + 1]) {
			context.source.exec(`UPDATE addon SET updated_at = ${outside} WHERE id = 'acme.two'`);

			expect((await failure(copy(context, true))).message).toBe(
				'addon.updated_at at (id) = ("acme.two"):',
			);
		}
	});

	test('refuses to replace a target that another table references', async () => {
		const context = await setup();

		await copy(context);
		await context.db.$client.unsafe(
			`CREATE TABLE foreign_ref (addon_id text REFERENCES addon (id)); INSERT INTO foreign_ref VALUES ('acme.one')`,
		);

		const before = await snapshot(context.db);
		const error = await failure(copy(context, true));
		const [row] = await context.db.$client`select count(*)::int as n from foreign_ref`;

		expect(error.message).toContain('foreign key');
		expect(row?.n).toBe(1);
		expect(await snapshot(context.db)).toEqual(before);
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
								write: (placeholder: string, sqlType: string) =>
									`${codecs.PgTimestamp.write(placeholder, sqlType)} + interval '1 millisecond'`,
							},
						}
					: column,
			),
		}));
		const error = await failure(
			copySqlite({ sqlitePath: context.source.path, targetUrl: context.target.url, specs }),
		);

		expect(error).toBeInstanceOf(VerificationError);

		const failed = (error as VerificationError).reports.filter((report) => !report.match);

		expect(failed.map((report) => report.table)).toEqual(['addon']);
		expect(failed[0]?.targetRows).toBe(failed[0]?.rows);
		expect(failed[0]?.targetChecksum).not.toBe(failed[0]?.checksum);
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

	test('names the row holding a value Postgres cannot hold, without the value, before writing anything', async () => {
		const role = 'addon_maintainer.role at (addon_id, user_id) = ("acme.one", "u1"):';
		const manifest = 'submission.manifest at (id) = ("sub1"):';
		const document = 'sync_document.document at (user_id) = ("u1"):';
		const cases = [
			{
				statement: `UPDATE addon_maintainer SET role = 'hidden' || char(0) || 'value'`,
				location: role,
				reason: 'NUL',
			},
			{
				statement: `UPDATE addon_maintainer SET role = cast(x'68696464656eff76616c7565' as text)`,
				location: role,
				reason: 'UTF-8',
			},
			{
				statement: `UPDATE submission SET manifest = '{"hidden":"a\\u0000value"}'`,
				location: manifest,
				reason: 'NUL',
			},
			{
				statement: `UPDATE submission SET manifest = '{"hidden":"a\\ud800value"}'`,
				location: manifest,
				reason: 'surrogate',
			},
			{
				statement: `UPDATE submission SET manifest = '{"hidden\\udc00value":1}'`,
				location: manifest,
				reason: 'surrogate',
			},
			{
				statement: `UPDATE sync_document SET document = '{"hidden":"' || char(0) || 'value"}'`,
				location: document,
				reason: 'NUL',
			},
			{
				statement: `UPDATE sync_document SET document = cast(x'7b2268696464656e223a22ff76616c7565227d' as text)`,
				location: document,
				reason: 'UTF-8',
			},
		];

		for (const { statement, location, reason } of cases) {
			const context = await setup();

			context.source.exec(statement);

			const error = await failure(copy(context));
			const cause = error.cause instanceof Error ? error.cause.message : '';
			const [target] = await context.db.$client`select to_regclass('addon') as addon`;

			expect(error.message).toBe(location);
			expect(cause).toContain(reason);
			expect(`${error.message} ${cause}`).not.toMatch(/hidden|value/);
			expect(target?.addon).toBeNull();
		}
	});

	test('copies a sync document with escaped NUL and lone surrogates, as the app stores it', async () => {
		const context = await setup();
		const stored = '{"plugins":{"a\\u0000b":{"enabled":true}},"x":"\\ud800","\\udc00":1}';

		context.source.exec(`UPDATE sync_document SET document = '${stored}'`);

		const reports = await copy(context);
		const [raw] = await context.db
			.$client`select document::text as document from sync_document`;
		const [row] = await context.db.select().from(syncDocument);

		expect(reports.find((report) => report.table === 'sync_document')?.match).toBe(true);
		expect(raw?.document).toBe(stored);
		expect(row?.document).toEqual(JSON.parse(stored));
	});

	test('refuses a source that is not the app database, leaving the target unchanged', async () => {
		const context = await setup();
		const directory = mkdtempSync(join(tmpdir(), 'unbound-sqlite-foreign-'));
		const empty = join(directory, 'empty.db');
		const foreign = join(directory, 'foreign.db');
		const handle = new Sqlite(foreign, { create: true });

		cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
		writeFileSync(empty, '');
		handle.exec('CREATE TABLE "__drizzle_migrations" (id INTEGER PRIMARY KEY, hash text)');
		handle.close();
		await copy(context);

		const before = await snapshot(context.db);

		for (const sqlitePath of [empty, foreign]) {
			for (const replace of [false, true]) {
				const error = await failure(
					copySqlite({ sqlitePath, targetUrl: context.target.url, replace }),
				);

				expect(error.message).toContain('none of the app tables');
			}
		}

		context.source.exec('DROP TABLE staff_note');

		const error = await failure(copy(context, true));

		expect(error.message).toContain('staff_note');
		expect(await snapshot(context.db)).toEqual(before);
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
		expect(first.stdout.toString()).toMatch(/^sync_document\s.*\bmatch$/m);
		expect(run().exitCode).toBe(1);
		expect(run('--replace').exitCode).toBe(0);
	});

	test('logs the retired table it skips with its row count', async () => {
		const context = await setup();
		const result = Bun.spawnSync(['bun', 'scripts/copy-sqlite.ts', context.source.path], {
			cwd: join(import.meta.dirname, '..'),
			env: { ...process.env, DATABASE_DIRECT_URL: context.target.url },
		});
		const output = `${result.stdout.toString()}${result.stderr.toString()}`;
		const skipped = output.split('\n').filter((line) => line.includes('bot_feed_change'));

		expect(result.exitCode).toBe(0);
		expect(skipped).toHaveLength(1);
		expect(skipped[0]).toMatch(
			new RegExp(`\\b${sourceCount(context.source, 'bot_feed_change')}\\b`),
		);
		expect(output).not.toContain('MISMATCH');
	});

	test('prints where Postgres refused a row', async () => {
		const context = await setup();

		context.source.exec(
			`INSERT INTO addon_maintainer (addon_id, user_id, role, created_at) VALUES ('acme.ghost', 'u1', 'owner', 0)`,
		);

		const result = Bun.spawnSync(['bun', 'scripts/copy-sqlite.ts', context.source.path], {
			cwd: join(import.meta.dirname, '..'),
			env: { ...process.env, DATABASE_DIRECT_URL: context.target.url },
		});
		const output = `${result.stdout.toString()}${result.stderr.toString()}`;

		expect(result.exitCode).toBe(1);
		expect(output).toContain('Key (addon_id)=(acme.ghost) is not present in table "addon".');
		expect(output).toContain('table addon_maintainer');
	});
});
