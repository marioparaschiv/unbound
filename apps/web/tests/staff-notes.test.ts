import { createStaffNoteRequestSchema } from '@unbound-app/contracts/admin';
import { dirname, join, relative, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'bun:test';
import type { SQLQueryBindings } from 'bun:sqlite';
import { existsSync, readdirSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { z } from 'zod/mini';

import {
	createStaffNote,
	deleteStaffNote,
	editStaffNote,
	listStaffNotes,
	queryStaffNotes,
} from '~/lib/staff-notes';
import { addon, staffNote, user } from '~/db/schema';
import { getAdminAddon } from '~/lib/admin-addon';
import { getAdminUser } from '~/lib/admin-users';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';

import { createTestContext, signInWithDiscord, snowflakeAt } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';

type PlanStep = {
	detail: string;
};

const base = createTestContext();

let clock = new Date('2026-10-23T12:00:00.000Z');

const ctx: AppContext = { ...base.ctx, now: () => clock };

afterAll(base.close);

let users = 0;

async function signUp(role: Role = 'user') {
	users += 1;

	const name = `Staff ${users}`;
	const { userId } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name,
		email: `notes-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	const caller: Caller = { user: row, via: 'session' };

	return { userId, name, caller };
}

function tick() {
	clock = new Date(clock.getTime() + 60_000);

	return clock;
}

function rejection(request: Promise<object | void>): Promise<Error | undefined> {
	return request.then(
		() => undefined,
		(error: Error) => error,
	);
}

async function seedAddon(id: string) {
	const owner = await signUp();

	await seedApprovedAddon(ctx, owner.userId, manifest(id));

	return owner;
}

describe('staff notes', () => {
	test('a moderator writes, reads, edits and deletes their own note', async () => {
		const moderator = await signUp('moderator');

		await seedAddon('notes.crud');

		const subject = { type: 'addon', id: 'notes.crud' } as const;
		const created = await createStaffNote(ctx, moderator.caller, {
			subject,
			body: 'Obfuscated bundle.',
		});
		const author = { id: moderator.userId, name: moderator.name, image: null };

		expect(await listStaffNotes(ctx, moderator.caller, subject)).toEqual([
			{
				id: created.id,
				author,
				body: 'Obfuscated bundle.',
				createdAt: clock,
				editedAt: null,
				mine: true,
			},
		]);

		const editedAt = tick();

		await editStaffNote(ctx, moderator.caller, {
			id: created.id,
			body: 'Obfuscated bundle; asked for the source.',
		});

		expect(await listStaffNotes(ctx, moderator.caller, subject)).toMatchObject([
			{ id: created.id, body: 'Obfuscated bundle; asked for the source.', editedAt },
		]);

		await deleteStaffNote(ctx, moderator.caller, { id: created.id });

		expect(await listStaffNotes(ctx, moderator.caller, subject)).toEqual([]);
	});

	test('lists a subject’s notes newest first and only that subject’s', async () => {
		const moderator = await signUp('moderator');
		const admin = await signUp('admin');
		const target = await signUp();
		const other = await signUp();
		const subject = { type: 'user', id: target.userId } as const;

		const first = await createStaffNote(ctx, moderator.caller, { subject, body: 'First.' });

		tick();

		const second = await createStaffNote(ctx, admin.caller, { subject, body: 'Second.' });

		await createStaffNote(ctx, admin.caller, {
			subject: { type: 'user', id: other.userId },
			body: 'Someone else.',
		});

		const notes = await listStaffNotes(ctx, moderator.caller, subject);

		expect(notes.map((note) => [note.id, note.mine])).toEqual([
			[second.id, false],
			[first.id, true],
		]);
	});

	test('a moderator cannot edit or delete another staff member’s note', async () => {
		const author = await signUp('moderator');
		const other = await signUp('moderator');
		const target = await signUp();
		const subject = { type: 'user', id: target.userId } as const;
		const note = await createStaffNote(ctx, author.caller, { subject, body: 'Alt account.' });

		expect(
			await rejection(editStaffNote(ctx, other.caller, { id: note.id, body: 'Rewritten.' })),
		).toMatchObject({ code: 'forbidden' });
		expect(await rejection(deleteStaffNote(ctx, other.caller, { id: note.id }))).toMatchObject({
			code: 'forbidden',
		});
		expect(await listStaffNotes(ctx, other.caller, subject)).toMatchObject([
			{ id: note.id, body: 'Alt account.', editedAt: null, mine: false },
		]);
	});

	test('editing or deleting a missing note is not_found', async () => {
		const moderator = await signUp('moderator');

		expect(
			await rejection(editStaffNote(ctx, moderator.caller, { id: 999_999, body: 'Hi.' })),
		).toMatchObject({ code: 'not_found' });
		expect(
			await rejection(deleteStaffNote(ctx, moderator.caller, { id: 999_999 })),
		).toMatchObject({ code: 'not_found' });
	});

	test('a note on a missing subject is not_found', async () => {
		const moderator = await signUp('moderator');

		expect(
			await rejection(
				createStaffNote(ctx, moderator.caller, {
					subject: { type: 'addon', id: 'notes.missing' },
					body: 'Hi.',
				}),
			),
		).toMatchObject({ code: 'not_found' });
	});

	test('a developer can neither list nor write notes', async () => {
		const developer = await signUp('developer');
		const moderator = await signUp('moderator');
		const target = await signUp();
		const subject = { type: 'user', id: target.userId } as const;
		const note = await createStaffNote(ctx, moderator.caller, { subject, body: 'Hidden.' });

		expect(await rejection(listStaffNotes(ctx, developer.caller, subject))).toMatchObject({
			code: 'forbidden',
		});
		expect(
			await rejection(createStaffNote(ctx, developer.caller, { subject, body: 'Hi.' })),
		).toMatchObject({ code: 'forbidden' });
		expect(
			await rejection(editStaffNote(ctx, developer.caller, { id: note.id, body: 'Hi.' })),
		).toMatchObject({ code: 'forbidden' });
	});

	test('the admin addon and user views carry the subject’s notes', async () => {
		const moderator = await signUp('moderator');
		const owner = await seedAddon('notes.view');
		const onAddon = await createStaffNote(ctx, moderator.caller, {
			subject: { type: 'addon', id: 'notes.view' },
			body: 'Addon note.',
		});
		const onUser = await createStaffNote(ctx, moderator.caller, {
			subject: { type: 'user', id: owner.userId },
			body: 'User note.',
		});

		const addonView = await getAdminAddon(ctx, moderator.caller, 'notes.view');
		const userView = await getAdminUser(ctx, moderator.caller, owner.userId);

		expect(addonView?.notes.map((note) => note.id)).toEqual([onAddon.id]);
		expect(userView?.notes.map((note) => note.id)).toEqual([onUser.id]);
	});

	test('notes are deleted with their subject and outlive their author', async () => {
		const author = await signUp('moderator');
		const reader = await signUp('moderator');
		const target = await signUp();

		await seedAddon('notes.cascade');

		const onAddon = await createStaffNote(ctx, author.caller, {
			subject: { type: 'addon', id: 'notes.cascade' },
			body: 'On the addon.',
		});
		const onUser = await createStaffNote(ctx, reader.caller, {
			subject: { type: 'user', id: target.userId },
			body: 'On the user.',
		});

		await ctx.db.delete(addon).where(eq(addon.id, 'notes.cascade'));
		await ctx.db.delete(user).where(eq(user.id, target.userId));
		await ctx.db.delete(user).where(eq(user.id, author.userId));

		const left = await ctx.db
			.select({ id: staffNote.id })
			.from(staffNote)
			.where(eq(staffNote.id, onAddon.id));

		expect(left).toEqual([]);
		expect(
			await ctx.db.query.staffNote.findFirst({ where: { id: onUser.id } }),
		).toBeUndefined();

		const kept = await signUp('moderator');
		const orphan = await seedAddon('notes.orphan');
		const gone = await signUp('moderator');
		const note = await createStaffNote(ctx, gone.caller, {
			subject: { type: 'user', id: orphan.userId },
			body: 'Author leaves.',
		});

		await ctx.db.delete(user).where(eq(user.id, gone.userId));

		expect(
			await listStaffNotes(ctx, kept.caller, { type: 'user', id: orphan.userId }),
		).toMatchObject([{ id: note.id, author: null, mine: false }]);
	});

	test('every note has exactly one subject', async () => {
		const moderator = await signUp('moderator');
		const target = await signUp();

		await seedAddon('notes.subject');

		const onUser = await createStaffNote(ctx, moderator.caller, {
			subject: { type: 'user', id: target.userId },
			body: 'User.',
		});
		const onAddon = await createStaffNote(ctx, moderator.caller, {
			subject: { type: 'addon', id: 'notes.subject' },
			body: 'Addon.',
		});
		const rows = await ctx.db
			.select({ id: staffNote.id, userId: staffNote.userId, addonId: staffNote.addonId })
			.from(staffNote)
			.where(eq(staffNote.authorId, moderator.userId));

		expect(rows.toSorted((a, b) => a.id - b.id)).toEqual([
			{ id: onUser.id, userId: target.userId, addonId: null },
			{ id: onAddon.id, userId: null, addonId: 'notes.subject' },
		]);

		// The request names one subject, so the API cannot build a row the CHECK rejects.
		expect(z.safeParse(createStaffNoteRequestSchema, { body: 'No subject.' }).success).toBe(
			false,
		);
		expect(
			z.safeParse(createStaffNoteRequestSchema, {
				subject: { type: 'both', id: target.userId },
				body: 'Hi.',
			}).success,
		).toBe(false);

		const insert = (userId: string | null, addonId: string | null) =>
			ctx.db.insert(staffNote).values({ userId, addonId, body: 'Raw.', createdAt: clock });

		expect(await rejection(insert(target.userId, 'notes.subject'))).toBeInstanceOf(Error);
		expect(await rejection(insert(null, null))).toBeInstanceOf(Error);
	});

	test('rejects an empty or overlong body and trims it', () => {
		const subject = { type: 'user', id: 'someone' } as const;
		const parse = (body: string) =>
			z.safeParse(createStaffNoteRequestSchema, { subject, body });

		expect(parse('   ').success).toBe(false);
		expect(parse('x'.repeat(5001)).success).toBe(false);
		expect(parse('  Trim me.  ').data?.body).toBe('Trim me.');
		expect(parse('x'.repeat(5000)).success).toBe(true);
	});

	test('reads a subject’s notes through its partial index without sorting', () => {
		const { sql, params } = queryStaffNotes(ctx, { type: 'addon', id: 'notes.crud' }).toSQL();
		const plan = ctx.db.$client
			.query<PlanStep, SQLQueryBindings[]>(`EXPLAIN QUERY PLAN ${sql}`)
			.all(...params.map((param) => (typeof param === 'number' ? param : String(param))))
			.map((step) => step.detail);

		expect(plan).toContainEqual(
			expect.stringMatching(/USING (COVERING )?INDEX staff_note_addon_idx \(addon_id=\?\)/),
		);
		expect(plan).not.toContainEqual(expect.stringMatching(/TEMP B-TREE/));
	});
});

const SRC = resolve(import.meta.dir, '../src');
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
const transpiler = new Bun.Transpiler({ loader: 'tsx' });

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { recursive: true, encoding: 'utf8' })
		.filter((name) => /\.tsx?$/.test(name))
		.map((name) => join(directory, name));
}

function resolveImport(from: string, specifier: string): string | undefined {
	let target: string | undefined;

	if (specifier.startsWith('~/')) {
		target = join(SRC, specifier.slice(2));
	} else if (specifier.startsWith('.')) {
		target = resolve(dirname(from), specifier);
	}

	if (!target) return;

	if (/\.tsx?$/.test(target) && existsSync(target)) {
		return target;
	}

	return EXTENSIONS.map((extension) => target + extension).find((path) => existsSync(path));
}

// Every source file the entries import, directly or through other source files.
async function reachable(entries: string[]): Promise<Set<string>> {
	const seen = new Set<string>();
	const queue = [...entries];

	for (let file = queue.pop(); file; file = queue.pop()) {
		if (seen.has(file)) {
			continue;
		}

		seen.add(file);

		const imports = transpiler.scanImports(await Bun.file(file).text());

		for (const { path } of imports) {
			const target = resolveImport(file, path);

			if (target) {
				queue.push(target);
			}
		}
	}

	return new Set([...seen].map((path) => relative(SRC, path)));
}

const STAFF_ONLY = ['lib/staff-notes.ts', 'lib/admin-functions.ts'];

describe('the public API surface', () => {
	test('no /api route or endpoint reaches the staff notes or admin server functions', async () => {
		const files = await reachable([
			...sourceFiles(join(SRC, 'routes/api')),
			...sourceFiles(join(SRC, 'endpoints')),
		]);

		expect(files.has('lib/addons.ts')).toBe(true);
		expect(STAFF_ONLY.filter((path) => files.has(path))).toEqual([]);
	});

	test('the admin pages do reach them, so the walk follows imports', async () => {
		const files = await reachable([join(SRC, 'routes/_site/_staff/admin/users/$id.tsx')]);

		expect(STAFF_ONLY.filter((path) => files.has(path))).toEqual(STAFF_ONLY);
	});
});
