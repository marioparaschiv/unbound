import {
	createTestDatabase,
	manifest,
	seedApprovedAddon,
	type TestDatabase,
} from '@unbound-app/web/testing';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import postgres from 'postgres';

import type { AddonChannels } from '~/dispatchers/addons';
import { contentHash } from '~/lib/content-hash';

import {
	createBotTestDatabase,
	DATABASE_URL,
	TEST_GRACE_DAYS,
	type BotTestDatabase,
} from './helpers/database';
import { moveData, type MoveOptions } from '../scripts/move-data';
import { signUp } from './helpers/web';

// The old bot database's tables the move reads, as its last migrations left them.
const OLD_SCHEMA = `
	CREATE TABLE feed_cursor (feed text PRIMARY KEY, cursor text NOT NULL);
	CREATE TABLE addon_message (
		addon_id text PRIMARY KEY, channel_id text NOT NULL, message_id text NOT NULL,
		posted_hash text NOT NULL, posted_at timestamptz DEFAULT now() NOT NULL, edited_at timestamptz
	);
	CREATE TABLE audit_event (
		id bigint PRIMARY KEY, kind text NOT NULL, subject_type text NOT NULL, subject_id text NOT NULL,
		created_at timestamptz NOT NULL, channel_id text, message_id text
	);
	CREATE TABLE loader_release (
		platform text, version text, url text NOT NULL, published_at timestamptz NOT NULL,
		channel_id text, message_id text, PRIMARY KEY (platform, version)
	);
	CREATE TABLE role_grant (
		discord_id text, role text, granted_at timestamptz DEFAULT now() NOT NULL,
		PRIMARY KEY (discord_id, role)
	);
	CREATE TABLE tag (
		id serial PRIMARY KEY, name text NOT NULL UNIQUE, content text NOT NULL,
		created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL
	);
`;

const CHANNELS: AddonChannels = { plugin: '11' };
const OPTIONS: MoveOptions = { sponsorGraceDays: TEST_GRACE_DAYS, channels: CHANNELS };

describe.skipIf(!DATABASE_URL)('move-data', () => {
	let database: BotTestDatabase;
	let old: TestDatabase;
	let source: postgres.Sql;
	let target: postgres.Sql;

	beforeAll(async () => {
		database = await createBotTestDatabase();
		old = await createTestDatabase();
		source = postgres(old.url, { max: 1, onnotice: () => void 0 });
		target = postgres(database.url, { max: 1, onnotice: () => void 0 });

		const owner = await signUp(database.web);

		await seedApprovedAddon(database.web, owner.userId, manifest('move.same'));
		await seedApprovedAddon(database.web, owner.userId, manifest('move.changed', '2.0.0'));

		const same = await database.reads.addon('move.same');

		await source.unsafe(OLD_SCHEMA);
		await source`
			insert into addon_message (addon_id, channel_id, message_id, posted_hash, posted_at, edited_at) values
			('move.same', '11', '501', ${same ? contentHash(same) : ''}, '2026-10-01 00:00:00.123456+00', null),
			('move.changed', '11', '502', 'posted-at-1.0.0', '2026-10-01 00:00:01+00', '2026-10-02 00:00:00+00'),
			('move.gone', '11', '503', 'posted', '2026-10-01 00:00:02+00', null)`;
		await source`
			insert into audit_event (id, kind, subject_type, subject_id, created_at, channel_id, message_id) values
			(1, 'addon.delisted', 'addon', 'a', now(), '12', '601'),
			(2, 'addon.relisted', 'addon', 'a', now(), null, null)`;
		await source`
			insert into loader_release (platform, version, url, published_at, channel_id, message_id) values
			('ios', '1.0.0', 'https://example.com', now(), '13', '701'),
			('android', '1.0.0', 'https://example.com', now(), null, null)`;
		await source`insert into role_grant (discord_id, role) values ('1', 'r-s'), ('2', 'r-a')`;
		await source`insert into tag (name, content) values ('faq', 'Read the FAQ.'), ('docs', 'Read the docs.')`;
	});

	afterAll(async () => {
		await Promise.all([source.end(), target.end()]);
		await old.drop();
		await database.drop();
	});

	test('copies every posted row, verifies each table and reports the addon posts that would change', async () => {
		const report = await moveData(source, target, OPTIONS);

		expect(report.tables.map((table) => [table.name, table.rows])).toEqual([
			['addon_message', 3],
			['audit_post', 1],
			['release_post', 1],
			['role_grant', 2],
			['tag', 2],
		]);
		expect(report.drift).toEqual({ equal: 1, wouldEdit: 1, wouldMove: 0, wouldDelete: 1 });
		expect([...(await target`select event_id, message_id from bot.audit_post`)]).toEqual([
			{ event_id: '1', message_id: '601' },
		]);
		expect([
			...(await target`
				select (extract(epoch from posted_at) * 1000)::bigint::text as ms
				from bot.addon_message where addon_id = 'move.same'`),
		]).toEqual([{ ms: String(Date.parse('2026-10-01T00:00:00.123Z')) }]);
	});

	test('a rerun converges to the same rows, and a new tag after it takes a fresh id', async () => {
		const first = await moveData(source, target, OPTIONS);

		await target`update bot.addon_message set posted_hash = 'drifted' where addon_id = 'move.gone'`;

		const second = await moveData(source, target, OPTIONS);

		expect(second).toEqual(first);
		expect([
			...(await target`insert into bot.tag (name, content) values ('new', 'New.') returning id`),
		]).toEqual([{ id: 3 }]);
		await target`delete from bot.tag where name = 'new'`;
	});

	test('refuses a target the bot already wrote to, and a source that is not the old bot database', async () => {
		await target`insert into bot.role_grant (discord_id, role) values ('9', 'r-c')`;

		await expect(moveData(source, target, OPTIONS)).rejects.toThrow(
			'bot.role_grant has row 9:r-c, which the source lacks',
		);

		await target`delete from bot.role_grant where discord_id = '9'`;

		await expect(moveData(target, target, OPTIONS)).rejects.toThrow('not the old bot database');
	});
});
