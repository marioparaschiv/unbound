import {
	createTestContext,
	manifest,
	schema,
	seedApprovedAddon,
	signInWithDiscord,
	withDatabase,
	type TestContext,
} from '@unbound-app/web/testing';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createBotReads, type BotReads } from '@unbound-app/web/bot';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import postgres from 'postgres';

import { createDatabase, type Database } from '~/db/database';
import { migrateDatabase } from '~/db/migrate';

import { TEST_GRACE_DAYS, waitFor } from './helpers/database';

type Grant = { table_name: string; privilege_type: string };
type Owner = { proname: string; owner: string };
type Phase = 'grant' | 'lock';

const SUPERUSER_URL = process.env.POSTGRES_SUPERUSER_URL;
const SCRIPT = join(import.meta.dirname, '..', 'scripts', 'provision.sql');
// A busy shared cluster can hold a CREATE or DROP DATABASE for seconds.
const DATABASE_DDL_TIMEOUT_MS = 30_000;

// Real roles, not the test cluster's usual one, because grants are the thing under test.
describe.skipIf(!SUPERUSER_URL)('provision.sql', () => {
	const hex = randomBytes(4).toString('hex');
	const names = {
		database: `unbound_web_test_${Date.now()}_${hex}`,
		web: `unbound_web_t_${hex}`,
		bot: `unbound_bot_t_${hex}`,
		hooks: `unbound_bot_t_${hex}_hooks`,
	};
	const password = randomBytes(12).toString('hex');
	const admin = postgres(SUPERUSER_URL ?? '', { max: 1, onnotice: () => void 0 });
	let target: postgres.Sql;
	let web: TestContext;
	let bot: Database;
	let reads: BotReads;

	function urlAs(role: string) {
		const url = new URL(withDatabase(SUPERUSER_URL ?? '', names.database));

		url.username = role;
		url.password = password;

		return url.toString();
	}

	function provision(phase: Phase = 'grant') {
		const url = new URL(withDatabase(SUPERUSER_URL ?? '', 'postgres'));
		// Stdin, as the runbook pipes it, because the postgres user cannot read the checkout.
		const run = Bun.spawnSync(
			[
				'psql',
				'-X',
				'-v',
				`database=${names.database}`,
				'-v',
				`web_role=${names.web}`,
				'-v',
				`bot_role=${names.bot}`,
				'-v',
				`phase=${phase}`,
				url.toString(),
			],
			{ stdin: Bun.file(SCRIPT), stdout: 'pipe', stderr: 'pipe' },
		);

		return { code: run.exitCode, output: `${run.stdout.toString()}${run.stderr.toString()}` };
	}

	function grants(): Promise<Grant[]> {
		return target<Grant[]>`
			select table_name, privilege_type from information_schema.role_table_grants
			where grantee = ${names.bot} and table_schema = 'public'
			order by table_name, privilege_type`;
	}

	function owners(): Promise<Owner[]> {
		return target<Owner[]>`
			select proname, pg_get_userbyid(proowner) as owner from pg_proc
			where pronamespace = 'bot'::regnamespace order by proname`;
	}

	async function state() {
		return { grants: [...(await grants())], owners: [...(await owners())] };
	}

	// The SQLSTATE and message the bot's own statement fails with, or 'allowed'.
	function refusalOf(query: Promise<object>) {
		return query.then(
			() => 'allowed',
			(error: postgres.PostgresError) => `${error.code} ${error.message}`,
		);
	}

	async function wakes(channel: string, write: () => Promise<string>) {
		const received: string[] = [];
		const listener = postgres(urlAs(names.bot), { max: 1, onnotice: () => void 0 });

		try {
			await listener.listen(channel, (payload) => void received.push(payload));

			const payload = await write();

			await waitFor(() => received.includes(payload));
		} finally {
			await listener.end();
		}
	}

	beforeAll(async () => {
		await admin.unsafe(`CREATE ROLE ${names.web} LOGIN PASSWORD '${password}'`);
		await admin.unsafe(`CREATE ROLE ${names.bot} LOGIN PASSWORD '${password}'`);
		await admin.unsafe(
			`CREATE DATABASE ${names.database} OWNER ${names.web} TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER libc LOCALE 'C'`,
		);
		target = postgres(withDatabase(SUPERUSER_URL ?? '', names.database), {
			max: 1,
			onnotice: () => void 0,
		});
	}, DATABASE_DDL_TIMEOUT_MS);

	afterAll(async () => {
		await bot?.$client.end();
		await target?.end();
		await web?.close();
		await admin.unsafe(`DROP DATABASE IF EXISTS ${names.database} WITH (FORCE)`);
		await admin.unsafe(`DROP ROLE IF EXISTS ${names.bot}`);
		await admin.unsafe(`DROP ROLE IF EXISTS ${names.hooks}`);
		await admin.unsafe(`DROP ROLE IF EXISTS ${names.web}`);
		await admin.end();
	}, DATABASE_DDL_TIMEOUT_MS);

	test('refuses to run before the web has migrated, naming what is missing', () => {
		const refused = provision();

		expect(refused.code).not.toBe(0);
		expect(refused.output).toContain("run the web's migrations first");
	});

	test('lets the bot role migrate, read the web through every read and listen to web writes', async () => {
		web = await createTestContext({}, async () => ({
			name: names.database,
			url: urlAs(names.web),
			drop: async () => void 0,
		}));

		const provisioned = provision();

		expect(provisioned).toMatchObject({ code: 0 });

		bot = createDatabase(urlAs(names.bot));
		await migrateDatabase(bot);
		reads = createBotReads(bot.$client, {
			siteUrl: 'https://unbound.rip',
			sponsorGraceDays: TEST_GRACE_DAYS,
		});

		const { userId } = await signInWithDiscord(web.ctx, {
			id: '900',
			name: 'Provisioned',
			email: 'provisioned@example.com',
		});

		await seedApprovedAddon(web.ctx, userId, manifest('provisioned.addon'));

		expect(await reads.addon('provisioned.addon')).toMatchObject({ version: '1.0.0' });
		expect(await reads.addons()).toHaveLength(1);
		expect(await reads.members({ by: 'all' })).toMatchObject([
			{ userId, discordId: '900', isAddonDeveloper: true },
		]);
		expect(await reads.members({ by: 'addon', ids: ['provisioned.addon'] })).toHaveLength(1);
		expect(await reads.eventsAfter(0, 10)).toEqual([]);
		expect(await reads.release({ platform: 'ios', version: '1.0.0' })).toBeUndefined();
		expect(await reads.releasesSince(new Date(0))).toEqual([]);

		await wakes('audit_event', insertEvent);
		expect(await reads.eventsAfter(0, 10)).toHaveLength(1);
	});

	async function insertEvent() {
		const [event] = await web.ctx.db
			.insert(schema.moderationEvent)
			.values({
				subjectType: 'addon',
				subjectId: 'provisioned.addon',
				kind: 'addon.delisted',
				data: {},
				createdAt: new Date(),
			})
			.returning({ id: schema.moderationEvent.id });

		return String(event?.id);
	}

	test('the lock phase leaves the bot no way to run code as the web role, and the triggers still fire', async () => {
		expect(provision('lock')).toMatchObject({ code: 0 });

		const denied = [
			bot.$client`select access_token from account`,
			bot.$client`select email from "user"`,
			bot.$client`select token from session`,
			bot.$client`insert into addon_maintainer (addon_id, user_id, role) values ('x', 'y', 'owner')`,
		];

		for (const query of denied) {
			expect(await refusalOf(query)).toStartWith('42501 permission denied');
		}

		// Replacing a hook's body would run the new body as whichever web role writes the table.
		expect(
			await refusalOf(
				bot.$client.unsafe(
					'CREATE OR REPLACE FUNCTION bot.notify_account() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$',
				),
			),
		).toBe('42501 must be owner of function notify_account');
		expect(
			await refusalOf(
				bot.$client.unsafe(
					'CREATE TRIGGER bot_steal AFTER UPDATE ON public.account FOR EACH ROW EXECUTE FUNCTION bot.notify_account()',
				),
			),
		).toBe('42501 permission denied for table account');
		// A schema named after the web role would lead its default search_path.
		expect(await refusalOf(bot.$client.unsafe(`CREATE SCHEMA "${names.web}"`))).toStartWith(
			'42501 permission denied for database',
		);

		await wakes('audit_event', insertEvent);
		await wakes('member_changed', async () => {
			const { userId } = await signInWithDiscord(web.ctx, {
				id: '901',
				name: 'Locked',
				email: 'locked@example.com',
			});

			return `user:${userId}`;
		});
		await migrateDatabase(bot);
		expect(await owners()).toHaveLength(7);
		expect(new Set((await owners()).map((row) => row.owner))).toEqual(new Set([names.hooks]));
	});

	test('each phase converges on a rerun, and grant then lock reopens and recloses the triggers', async () => {
		const locked = await state();

		expect(locked.grants.map((grant) => grant.privilege_type)).toEqual(
			Array.from({ length: 6 }, () => 'SELECT'),
		);

		await target.unsafe(`GRANT SELECT ON public.session TO ${names.bot}`);

		expect(provision('grant')).toMatchObject({ code: 0 });
		expect(provision('grant')).toMatchObject({ code: 0 });

		const granted = await state();

		expect(granted.grants).toEqual(
			expect.arrayContaining([
				{ table_name: 'account', privilege_type: 'TRIGGER' },
				{ table_name: 'addon', privilege_type: 'SELECT' },
			]),
		);
		expect(granted.grants.some((grant) => grant.table_name === 'session')).toBe(false);
		expect(new Set(granted.owners.map((row) => row.owner))).toEqual(new Set([names.bot]));

		expect(provision('lock')).toMatchObject({ code: 0 });
		expect(provision('lock')).toMatchObject({ code: 0 });
		expect(await state()).toEqual(locked);
	});
});
