// Copies the bot's posted state from its old database (`unbound_bot`) into schema `bot` of the web's
// database: `SOURCE_DATABASE_URL=… bun run db:move-data`, bot stopped, after `db:migrate`. Rerunnable.
import { createBotReads } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';
import postgres from 'postgres';
import { z } from 'zod';

import { ADDON_CHANNELS, type AddonChannels } from '~/dispatchers/addons';
import { contentHash } from '~/lib/content-hash';
import { parseDatabaseEnv } from '~/lib/env';
import { SITE_URL } from '~/lib/constants';
import { envSchema } from '~/lib/env';

type Row = Record<string, string | number | boolean | null>;

/** One old table's rows carried into one table of schema `bot`, compared under the same projection. */
type TableMove = {
	name: string;
	key: readonly string[];
	/** The source's rows, projected to the target's columns. */
	readSource: (sql: postgres.Sql) => Promise<Row[]>;
	/** The target's rows under the same projection. */
	readTarget: (sql: postgres.Sql) => Promise<Row[]>;
	/** Inserts missing rows and overwrites differing ones with the source's values. */
	write: (sql: postgres.TransactionSql, rows: Row[]) => Promise<void>;
};

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
	/** Days sponsor perks outlast a sponsorship, for the read model the drift report uses. */
	sponsorGraceDays: number;
	channels?: AddonChannels;
};

const logger = createLogger('Bot', 'Move');

// Timestamps compare as epoch milliseconds: the old columns are microsecond `timestamptz`.
function ms(column: string) {
	return `(extract(epoch from ${column}) * 1000)::bigint::text as ${column}`;
}

function select(columns: string[], from: string, where: string = 'true') {
	return (sql: postgres.Sql) =>
		sql.unsafe<Row[]>(`select ${columns.join(', ')} from ${from} where ${where}`);
}

function upsert(table: string, key: readonly string[], columns: readonly string[]) {
	const updates = columns.filter((column) => !key.includes(column));
	const set = updates.map((column) => `${column} = excluded.${column}`).join(', ');

	return async (sql: postgres.TransactionSql, rows: Row[]) => {
		if (!rows.length) return;

		await sql`
			insert into ${sql(table)} ${sql(rows, ...columns)}
			on conflict (${sql(key)}) do update set ${sql.unsafe(set)}`;
	};
}

const MOVES: TableMove[] = [
	{
		name: 'addon_message',
		key: ['addon_id'],
		readSource: select(
			[
				'addon_id',
				'channel_id',
				'message_id',
				'posted_hash',
				ms('posted_at'),
				ms('edited_at'),
			],
			'public.addon_message',
		),
		readTarget: select(
			[
				'addon_id',
				'channel_id',
				'message_id',
				'posted_hash',
				ms('posted_at'),
				ms('edited_at'),
			],
			'bot.addon_message',
		),
		write: async (sql, rows) =>
			upsert(
				'bot.addon_message',
				['addon_id'],
				['addon_id', 'channel_id', 'message_id', 'posted_hash', 'posted_at', 'edited_at'],
			)(sql, rows.map(withDates('posted_at', 'edited_at'))),
	},
	{
		name: 'audit_post',
		key: ['event_id'],
		readSource: select(
			['id::text as event_id', 'channel_id', 'message_id'],
			'public.audit_event',
			'message_id is not null',
		),
		readTarget: select(
			['event_id::text as event_id', 'channel_id', 'message_id'],
			'bot.audit_post',
		),
		write: upsert('bot.audit_post', ['event_id'], ['event_id', 'channel_id', 'message_id']),
	},
	{
		name: 'release_post',
		key: ['platform', 'version'],
		readSource: select(
			['platform', 'version', 'channel_id', 'message_id'],
			'public.loader_release',
			'message_id is not null',
		),
		readTarget: select(['platform', 'version', 'channel_id', 'message_id'], 'bot.release_post'),
		write: upsert(
			'bot.release_post',
			['platform', 'version'],
			['platform', 'version', 'channel_id', 'message_id'],
		),
	},
	{
		name: 'role_grant',
		key: ['discord_id', 'role'],
		readSource: select(['discord_id', 'role', ms('granted_at')], 'public.role_grant'),
		readTarget: select(['discord_id', 'role', ms('granted_at')], 'bot.role_grant'),
		write: async (sql, rows) =>
			upsert(
				'bot.role_grant',
				['discord_id', 'role'],
				['discord_id', 'role', 'granted_at'],
			)(sql, rows.map(withDates('granted_at'))),
	},
	{
		name: 'tag',
		key: ['id'],
		readSource: select(
			['id::text as id', 'name', 'content', ms('created_at'), ms('updated_at')],
			'public.tag',
		),
		readTarget: select(
			['id::text as id', 'name', 'content', ms('created_at'), ms('updated_at')],
			'bot.tag',
		),
		write: async (sql, rows) => {
			await upsert(
				'bot.tag',
				['id'],
				['id', 'name', 'content', 'created_at', 'updated_at'],
			)(sql, rows.map(withDates('created_at', 'updated_at')));
			// Copied ids skip the sequence, so the next tag would collide without this.
			await sql`select setval(pg_get_serial_sequence('bot.tag', 'id'), greatest((select max(id) from bot.tag), 1))`;
		},
	},
];

function withDates(...columns: string[]) {
	return (row: Row): Row => {
		const copy = { ...row };

		for (const column of columns) {
			const value = copy[column];

			copy[column] = value === null ? null : new Date(Number(value)).toISOString();
		}

		return copy;
	};
}

function keyOf(move: TableMove, row: Row) {
	return move.key.map((column) => String(row[column])).join(':');
}

function canonical(move: TableMove, rows: Row[]) {
	const lines = rows.map((row) => {
		const sorted = Object.fromEntries(
			Object.keys(row)
				.toSorted()
				.map((column) => [column, row[column] ?? null]),
		);

		return [keyOf(move, row), JSON.stringify(sorted)] as const;
	});

	return new Map(lines.toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function checksum(lines: Map<string, string>) {
	const hasher = new Bun.CryptoHasher('sha256');

	for (const line of lines.values()) {
		hasher.update(`${line}\n`);
	}

	return hasher.digest('hex');
}

// Fails on the first difference, naming the table, both counts and the first key that differs.
function verify(
	move: TableMove,
	source: Map<string, string>,
	target: Map<string, string>,
): TableReport {
	const extra = [...target.keys()].find((key) => !source.has(key));

	if (extra !== undefined) {
		throw new Error(
			`bot.${move.name} has row ${extra}, which the source lacks: the bot already ran against this database. Stop it and decide which rows to keep.`,
		);
	}

	const differing = [...source.keys()].find((key) => source.get(key) !== target.get(key));
	const [sourceSum, targetSum] = [checksum(source), checksum(target)];

	if (differing !== undefined || source.size !== target.size || sourceSum !== targetSum) {
		throw new Error(
			`bot.${move.name} does not match the source: ${source.size} source rows, ${target.size} target rows, first differing key ${differing}.`,
		);
	}

	return { name: move.name, rows: target.size, checksum: targetSum };
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
	const reads = createBotReads(target, {
		siteUrl: SITE_URL,
		sponsorGraceDays: options.sponsorGraceDays,
	});
	const posts = await target<{ addonId: string; channelId: string; postedHash: string }[]>`
		select addon_id as "addonId", channel_id as "channelId", posted_hash as "postedHash" from bot.addon_message`;
	const drift: HashDrift = { equal: 0, wouldEdit: 0, wouldMove: 0, wouldDelete: 0 };

	for (const post of posts) {
		const addon = await reads.addon(post.addonId);
		const channelId = addon?.listed ? channels[addon.type] : undefined;

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
 * @description Copies every posted-state table from the old bot database into schema `bot`, then
 * verifies each by count and checksum and reports what the first addon reconcile would change.
 * @param source The old bot database.
 * @param target The web's database, with the bot's migrations applied.
 * @param options The sponsor grace period and the addon channels the drift report judges with.
 * @returns Each table's row count and checksum, and the addon post drift.
 */
export async function moveData(
	source: postgres.Sql,
	target: postgres.Sql,
	options: MoveOptions,
): Promise<MoveReport> {
	await preflight(source, target);

	const rows = await Promise.all(MOVES.map((move) => move.readSource(source)));

	await target.begin(async (sql) => {
		for (const [index, move] of MOVES.entries()) {
			await move.write(sql, rows[index] ?? []);
		}
	});

	const tables: TableReport[] = [];

	for (const [index, move] of MOVES.entries()) {
		tables.push(
			verify(
				move,
				canonical(move, rows[index] ?? []),
				canonical(move, await move.readTarget(target)),
			),
		);
	}

	return { tables, drift: await hashDrift(target, options) };
}

const moveEnvSchema = z.object({ SOURCE_DATABASE_URL: z.string().min(1) });

if (import.meta.main) {
	const { DATABASE_DIRECT_URL } = parseDatabaseEnv();
	const { SOURCE_DATABASE_URL } = moveEnvSchema.parse(process.env);
	const { SPONSOR_PERK_GRACE_DAYS } = envSchema
		.pick({ SPONSOR_PERK_GRACE_DAYS: true })
		.parse(process.env);
	const source = postgres(SOURCE_DATABASE_URL, { max: 1, onnotice: () => void 0 });
	const target = postgres(DATABASE_DIRECT_URL, { max: 1, onnotice: () => void 0 });

	try {
		const report = await moveData(source, target, {
			sponsorGraceDays: SPONSOR_PERK_GRACE_DAYS,
		});

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
