import type { ModerationEvent, Subject } from '@unbound-app/contracts/admin';
import { afterAll, describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import type { SQLQueryBindings } from 'bun:sqlite';
import { eq } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MIGRATIONS_FOLDER, migrateDatabase } from '~/db/migrate';
import { listEvents, queryEvents } from '~/lib/moderation-events';
import { moderationEvent, user } from '~/db/schema';
import type { AppContext } from '~/lib/context';
import { createDatabase } from '~/db/database';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';

import { createTestContext, signInWithDiscord, snowflakeAt } from './helpers/context';
import { manifest } from './helpers/addons';

type PlanStep = {
	detail: string;
};

// Matched by name, not timestamp, so regenerating the migration on a rebase keeps this test valid.
const EVENTS_MIGRATION_SUFFIX = '_moderation_events';

const base = createTestContext({ EVENT_PAGE_SIZE: '2' });

let clock = new Date('2026-10-23T12:00:00.000Z');

const ctx: AppContext = { ...base.ctx, now: () => clock };

afterAll(base.close);

let users = 0;

async function signUp(role: Role = 'user') {
	users += 1;

	const { userId } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name: `Member ${users}`,
		email: `events-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	const caller: Caller = { user: row, via: 'session' };

	return { userId, caller };
}

type Member = Awaited<ReturnType<typeof signUp>>;

function tick() {
	clock = new Date(clock.getTime() + 60_000);

	return clock;
}

async function timeline(viewer: Member, subject: Subject): Promise<ModerationEvent[]> {
	const items: ModerationEvent[] = [];
	let before: number | undefined;

	do {
		const page = await listEvents(ctx, viewer.caller, subject, before);

		items.push(...page.items);
		before = page.before ?? undefined;
	} while (before !== undefined);

	return items;
}

function rejection(request: Promise<object>): Promise<Error | undefined> {
	return request.then(
		() => undefined,
		(error: Error) => error,
	);
}

function addonSubject(id: string): Subject {
	return { type: 'addon', id };
}

describe('the timeline', () => {
	test('pages newest first and skips rows that no longer parse', async () => {
		const moderator = await signUp('moderator');
		const subject = addonSubject('events.paged');
		const rows = [
			'addon.delisted',
			'review.decided',
			'addon.relisted',
			'addon.delisted',
		] as const;

		for (const kind of rows) {
			await ctx.db.insert(moderationEvent).values({
				subjectType: subject.type,
				subjectId: subject.id,
				actorId: moderator.userId,
				kind,
				data: {},
				createdAt: tick(),
			});
		}

		const first = await listEvents(ctx, moderator.caller, subject);
		const events = await timeline(moderator, subject);

		expect(first.items).toHaveLength(2);
		expect(first.before).toBe(first.items[1]?.id ?? null);
		expect(events.map((event) => event.kind)).toEqual([
			'addon.delisted',
			'addon.relisted',
			'addon.delisted',
		]);
	});

	test('needs the subject read permission', async () => {
		const member = await signUp();

		expect(
			await rejection(listEvents(ctx, member.caller, addonSubject('events.cycle'))),
		).toMatchObject({ code: 'forbidden' });
		expect(
			await rejection(listEvents(ctx, member.caller, { type: 'user', id: member.userId })),
		).toMatchObject({ code: 'forbidden' });
	});

	test('reads the subject index newest first without sorting', async () => {
		const { sql, params } = queryEvents(ctx, addonSubject('events.cycle'), 10).toSQL();
		const plan = ctx.db.$client
			.query<PlanStep, SQLQueryBindings[]>(`EXPLAIN QUERY PLAN ${sql}`)
			.all(...params.map((param) => (typeof param === 'number' ? param : String(param))))
			.map((step) => step.detail);

		expect(plan).toContainEqual(
			expect.stringMatching(
				/USING INDEX moderation_event_subject_idx \(subject_type=\? AND subject_id=\? AND rowid<\?\)/,
			),
		);
		expect(plan).not.toContainEqual(expect.stringMatching(/TEMP B-TREE/));
	});
});

describe('events migration', () => {
	test('backfills the review decisions recorded on submissions', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'ub-events-'));
		const previous = join(directory, 'migrations');
		const migrations = (await readdir(MIGRATIONS_FOLDER)).toSorted();
		const applied = migrations.slice(
			0,
			migrations.findIndex((name) => name.endsWith(EVENTS_MIGRATION_SUFFIX)),
		);
		const db = createDatabase(join(directory, 'app.db'));

		try {
			for (const name of applied) {
				await cp(join(MIGRATIONS_FOLDER, name), join(previous, name), { recursive: true });
			}

			migrate(db, { migrationsFolder: previous });

			db.$client.run(
				`INSERT INTO user (id, name, email, role) VALUES ('a', 'A', 'a@example.com', 'user'), ('m', 'M', 'm@example.com', 'moderator')`,
			);

			// The changes-requested listing was republished, so only its superseded row keeps the decision.
			const submissions = [
				['s-changes', 'listing', 'superseded', 'changes_requested', 'Add a README.', 1000],
				['s-approved', 'listing', 'approved', 'approved', 'Thanks.', 2000],
				['s-pending', 'update', 'pending_review', null, null, null],
			] as const;

			for (const [id, kind, status, decision, note, reviewedAt] of submissions) {
				db.$client.run(
					`INSERT INTO submission (id, addon_id, author_id, kind, status, version, manifest, bundle_size, staging_key, upload_expires_at, created_at, reviewer_id, review_decision, review_note, reviewed_at)
					VALUES (?, 'old.addon', 'a', ?, ?, '1.0.0', ?, 1, ?, 0, 0, ?, ?, ?, ?)`,
					[
						id,
						kind,
						status,
						JSON.stringify(manifest('old.addon')),
						id,
						decision ? 'm' : null,
						decision,
						note,
						reviewedAt,
					],
				);
			}

			migrateDatabase(db);

			const moderator = await signUp('moderator');
			const events = await listEvents(
				{ ...ctx, db },
				moderator.caller,
				addonSubject('old.addon'),
			);

			expect(events.items).toMatchObject([
				{
					kind: 'review.decided',
					actor: { id: 'm' },
					reason: 'Thanks.',
					createdAt: new Date(2000).toISOString(),
					data: {
						submissionId: 's-approved',
						submissionKind: 'listing',
						decision: 'approved',
					},
				},
				{
					kind: 'review.decided',
					reason: 'Add a README.',
					createdAt: new Date(1000).toISOString(),
					data: { submissionId: 's-changes', decision: 'changes_requested' },
				},
			]);
		} finally {
			db.$client.close();
			await rm(directory, { recursive: true });
		}
	});
});
