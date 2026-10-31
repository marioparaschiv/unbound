// Copies the bot's posted state from its old database (`unbound_bot`) into schema `bot` of the web's
// database: `SOURCE_DATABASE_URL=… bun run db:move-data`, bot stopped, after `db:migrate`. Rerunnable.
import { createBotReads } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';
import postgres from 'postgres';
import { z } from 'zod';

import { ADDON_CHANNELS, desiredChannel, type AddonChannels } from '~/dispatchers/addons';
import { contentHash } from '~/lib/content-hash';
import { parseDatabaseEnv } from '~/lib/env';
import { SITE_URL } from '~/lib/constants';

type Row = Record<string, string | null>;

/** One old table's posted rows and the table of schema `bot` they move to; both reads and the insert derive from it. */
type TableSpec = {
	/** The table in schema `bot`. */
	target: string;
	/** The table in the old database's `public`. */
	source: string;
	/** Which source rows were posted. */
	where?: string;
	key: readonly string[];
	/** The target's columns, compared and copied. */
	columns: readonly string[];
	/** Compared as epoch milliseconds: the old columns are microsecond `timestamptz`. */
	timestamps?: readonly string[];
	/** Target column to the source column it is read from, where the names differ. */
	renames?: Readonly<Record<string, string>>;
	/** A serial column whose sequence must pass the copied ids. */
	serial?: string;
};

type Side = 'source' | 'target';

/** One row with its canonical line, the form both sides are compared and hashed in. */
type CanonicalRow = { row: Row; line: string };

/** A table's rows by key. */
type Snapshot = Map<string, CanonicalRow>;

export type TableReport = {
	name: string;
	rows: number;
	checksum: string;
};

/** What the first reconcile after the move would do to each moved addon post. */
export type HashDrift = {
	equal: number;
	wouldEdit: number;
	wouldMove: number;
	wouldDelete: number;
};

export type MoveReport = {
	tables: TableReport[];
	drift: HashDrift;
};

export type MoveOptions = {
	/** The channel each addon type posts to, for the drift report. */
	channels?: AddonChannels;
};

const logger = createLogger('Bot', 'Move');

const TABLES: TableSpec[] = [
	{
		target: 'addon_message',
		source: 'addon_message',
		key: ['addon_id'],
		columns: ['addon_id', 'channel_id', 'message_id', 'posted_hash', 'posted_at', 'edited_at'],
		timestamps: ['posted_at', 'edited_at'],
	},
	{
		target: 'audit_post',
		source: 'audit_event',
		where: 'message_id is not null',
		key: ['event_id'],
		columns: ['event_id', 'channel_id', 'message_id'],
		renames: { event_id: 'id' },
	},
	{
		target: 'release_post',
		source: 'loader_release',
		where: 'message_id is not null',
		key: ['platform', 'version'],
		columns: ['platform', 'version', 'channel_id', 'message_id'],
	},
	{
		target: 'role_grant',
		source: 'role_grant',
		key: ['discord_id', 'role'],
		columns: ['discord_id', 'role', 'granted_at'],
		timestamps: ['granted_at'],
	},
	{
		target: 'tag',
		source: 'tag',
		key: ['id'],
		columns: ['id', 'name', 'content', 'created_at', 'updated_at'],
		timestamps: ['created_at', 'updated_at'],
		serial: 'id',
	},
];

// Every value is read as text, so both sides compare the same whatever their column types.
function projection(table: TableSpec, side: Side) {
	const columns = table.columns.map((column) => {
		const from = side === 'source' ? (table.renames?.[column] ?? column) : column;

		return table.timestamps?.includes(column)
			? `(extract(epoch from ${from}) * 1000)::bigint::text as ${column}`
			: `${from}::text as ${column}`;
	});
	const from = side === 'source' ? `public.${table.source}` : `bot.${table.target}`;
	const where = side === 'source' ? (table.where ?? 'true') : 'true';

	return `select ${columns.join(', ')} from ${from} where ${where}`;
}

async function read(
	sql: postgres.Sql | postgres.TransactionSql,
	table: TableSpec,
	side: Side,
): Promise<Snapshot> {
	const rows = await sql.unsafe<Row[]>(projection(table, side));
	const entries = rows.map((row) => {
		const key = table.key.map((column) => String(row[column])).join(':');
		const line = JSON.stringify(table.columns.map((column) => row[column] ?? null));

		return [key, { row, line }] as const;
	});

	return new Map(entries.toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function checksum(snapshot: Snapshot) {
	const hasher = new Bun.CryptoHasher('sha256');

	for (const { line } of snapshot.values()) {
		hasher.update(`${line}\n`);
	}

	return hasher.digest('hex');
}

// Names the first target row the source lacks or disagrees with; the move never overwrites one.
function conflict(table: TableSpec, source: Snapshot, target: Snapshot): string | undefined {
	for (const [key, { line }] of target) {
		const expected = source.get(key)?.line;

		if (expected === undefined) {
			return `bot.${table.target} has row ${key}, which the source lacks`;
		}

		if (expected !== line) {
			return `bot.${table.target} row ${key} is ${line}, but the source has ${expected}`;
		}
	}
}

async function insertMissing(sql: postgres.TransactionSql, table: TableSpec, rows: Row[]) {
	if (!rows.length) return;

	const values = rows.map((row) => {
		const copy = { ...row };

		for (const column of table.timestamps ?? []) {
			const value = copy[column];

			copy[column] = value ? new Date(Number(value)).toISOString() : null;
		}

		return copy;
	});

	await sql`
		insert into ${sql(`bot.${table.target}`)} ${sql(values, ...table.columns)}
		on conflict do nothing`;

	// Copied ids skip the sequence, so the next row would collide without this.
	if (table.serial) {
		await sql`
			select setval(
				pg_get_serial_sequence(${`bot.${table.target}`}, ${table.serial}),
				greatest((select max(${sql(table.serial)}) from ${sql(`bot.${table.target}`)}), 1)
			)`;
	}
}

async function preflight(source: postgres.Sql, target: postgres.Sql) {
	const [old] = await source<
		{ feed: string | null }[]
	>`select to_regclass('public.feed_cursor')::text as feed`;

	if (!old?.feed) {
		throw new Error(
			'SOURCE_DATABASE_URL has no feed_cursor table, so it is not the old bot database.',
		);
	}

	const [migrated] = await target<{ history: string | null }[]>`
		select to_regclass('bot.__drizzle_migrations')::text as history`;

	if (!migrated?.history) {
		throw new Error('The target has no bot schema history; run `bun run db:migrate` first.');
	}
}

async function hashDrift(target: postgres.Sql, options: MoveOptions): Promise<HashDrift> {
	const { channels = ADDON_CHANNELS } = options;
	const reads = createBotReads(target, { siteUrl: SITE_URL });
	const posts = await target<{ addonId: string; channelId: string; postedHash: string }[]>`
		select addon_id as "addonId", channel_id as "channelId", posted_hash as "postedHash" from bot.addon_message`;
	const drift: HashDrift = { equal: 0, wouldEdit: 0, wouldMove: 0, wouldDelete: 0 };

	for (const post of posts) {
		const addon = await reads.addon(post.addonId);
		const channelId = addon ? desiredChannel(addon, channels) : undefined;

		if (!addon || !channelId) {
			drift.wouldDelete++;
		} else if (channelId !== post.channelId) {
			drift.wouldMove++;
		} else if (contentHash(addon) === post.postedHash) {
			drift.equal++;
		} else {
			drift.wouldEdit++;
		}
	}

	return drift;
}

/**
 * @description Copies the posted-state rows schema `bot` lacks from the old bot database, refusing
 * before any write when the target holds a row the source lacks or disagrees with.
 * @param source The old bot database.
 * @param target The web's database, with the bot's migrations applied.
 * @param options The addon channels the drift report judges with.
 * @returns Each table's row count and checksum after the move, and the addon post drift.
 */
export async function moveData(
	source: postgres.Sql,
	target: postgres.Sql,
	options: MoveOptions = {},
): Promise<MoveReport> {
	await preflight(source, target);

	const sources: [TableSpec, Snapshot][] = [];

	for (const table of TABLES) {
		const from = await read(source, table, 'source');
		const found = conflict(table, from, await read(target, table, 'target'));

		if (found) {
			throw new Error(
				`${found}: the bot already ran against this database. Stop it and decide which rows to keep; nothing was written.`,
			);
		}

		sources.push([table, from]);
	}

	await target.begin(async (sql) => {
		for (const [table, from] of sources) {
			const into = await read(sql, table, 'target');
			const missing = [...from].filter(([key]) => !into.has(key)).map(([, { row }]) => row);

			await insertMissing(sql, table, missing);
		}
	});

	const tables: TableReport[] = [];

	for (const [table, from] of sources) {
		const into = await read(target, table, 'target');
		const found = conflict(table, from, into);

		if (found || into.size !== from.size || checksum(into) !== checksum(from)) {
			throw new Error(
				`bot.${table.target} does not match the source after the move: ${from.size} source rows, ${into.size} target rows${found ? `, ${found}` : ''}.`,
			);
		}

		tables.push({ name: table.target, rows: into.size, checksum: checksum(into) });
	}

	return { tables, drift: await hashDrift(target, options) };
}

const moveEnvSchema = z.object({ SOURCE_DATABASE_URL: z.string().min(1) });

if (import.meta.main) {
	const { DATABASE_DIRECT_URL } = parseDatabaseEnv();
	const { SOURCE_DATABASE_URL } = moveEnvSchema.parse(process.env);
	const source = postgres(SOURCE_DATABASE_URL, { max: 1, onnotice: () => void 0 });
	const target = postgres(DATABASE_DIRECT_URL, { max: 1, onnotice: () => void 0 });

	try {
		const report = await moveData(source, target);

		for (const table of report.tables) {
			logger.success(`moved ${table.name}: ${table.rows} rows, sha256 ${table.checksum}`);
		}

		const { equal, wouldEdit, wouldMove, wouldDelete } = report.drift;

		logger.info(
			`Addon posts on the first reconcile: ${equal} unchanged, ${wouldEdit} edited, ${wouldMove} moved, ${wouldDelete} deleted.`,
		);
	} catch (error) {
		logger.error('The move failed:', error);
		process.exitCode = 1;
	} finally {
		await Promise.all([source.end(), target.end()]);
	}
}
