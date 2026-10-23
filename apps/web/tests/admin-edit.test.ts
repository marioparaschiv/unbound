import { editAddonRequestSchema } from '@unbound-app/contracts/admin';
import type { EditAddonRequest } from '@unbound-app/contracts/admin';
import { afterAll, describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { eq } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getAddonDetails, getCatalog, listAddons } from '~/lib/addons';
import { MIGRATIONS_FOLDER, migrateDatabase } from '~/db/migrate';
import { editAddon, getAdminAddon } from '~/lib/admin-addon';
import { addon, moderationEvent, user } from '~/db/schema';
import type { AppContext } from '~/lib/context';
import { createDatabase } from '~/db/database';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';
import { serveVersion } from '~/lib/rollback';

import { createTestContext, signInWithDiscord, snowflakeAt } from './helpers/context';
import { manifest, seedApprovedAddon, seedVersion } from './helpers/addons';

const EDIT_MIGRATION = '20261023165207_admin_edit';

const base = createTestContext({ ADDON_LIST_PAGE_SIZE: '100' });
const ctx: AppContext = base.ctx;

afterAll(base.close);

let users = 0;

async function callerOf(userId: string): Promise<Caller> {
	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	return { user: row, via: 'session' };
}

async function signUp(role: Role = 'user') {
	users += 1;

	const { userId } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name: `Member ${users}`,
		email: `edit-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	return { userId, caller: await callerOf(userId) };
}

const owner = await signUp();
const admin = await signUp('admin');
const moderator = await signUp('moderator');

function release(id: string, version: string) {
	return manifest(id, version, {
		name: `Hello ${version}`,
		description: `Says hello in ${version}.`,
	});
}

async function formOf(id: string, caller: Caller = admin.caller): Promise<EditAddonRequest> {
	const view = await getAdminAddon(ctx, caller, id);

	if (!view) {
		throw new Error(`Addon ${id} has no admin view.`);
	}

	return view.form;
}

async function displayed(id: string) {
	const [row, listing, catalog, details] = await Promise.all([
		ctx.db.query.addon.findFirst({ where: { id } }),
		listAddons(ctx),
		getCatalog(ctx),
		getAddonDetails(ctx, id),
	]);
	const listed = listing.addons.find((entry) => entry.id === id);
	const snapshot = catalog.addons.find((entry) => entry.id === id);

	return {
		row: { name: row?.name, description: row?.description, type: row?.type },
		listing: [listed?.name, listed?.description],
		catalog: [snapshot?.name, snapshot?.description],
		details: [details?.name, details?.description],
	};
}

function eventsOf(id: string) {
	return ctx.db.query.moderationEvent.findMany({
		where: { subjectType: 'addon', subjectId: id },
		orderBy: { id: 'asc' },
	});
}

function rejection(request: Promise<object>): Promise<Error | undefined> {
	return request.then(
		() => undefined,
		(error: Error) => error,
	);
}

describe('editAddon', () => {
	test('a pinned name survives later approvals and rollbacks while the description follows the manifest', async () => {
		await seedApprovedAddon(ctx, owner.userId, release('edit.pin', '1.0.0'));

		const form = await formOf('edit.pin');

		await editAddon(ctx, admin.caller, 'edit.pin', { ...form, name: 'Greeter' });
		await seedVersion(ctx, owner.userId, release('edit.pin', '1.1.0'));

		expect(await displayed('edit.pin')).toEqual({
			row: { name: 'Greeter', description: 'Says hello in 1.1.0.', type: 'plugin' },
			listing: ['Greeter', 'Says hello in 1.1.0.'],
			catalog: ['Greeter', 'Says hello in 1.1.0.'],
			details: ['Greeter', 'Says hello in 1.1.0.'],
		});

		serveVersion(ctx, admin.caller, 'edit.pin', { version: '1.0.0', reason: 'Broken' });

		expect((await displayed('edit.pin')).row).toEqual({
			name: 'Greeter',
			description: 'Says hello in 1.0.0.',
			type: 'plugin',
		});
	});

	test('resetting a field unpins it and re-derives it from the served manifest', async () => {
		await seedApprovedAddon(ctx, owner.userId, release('edit.reset', '1.0.0'));
		await editAddon(ctx, admin.caller, 'edit.reset', {
			...(await formOf('edit.reset')),
			name: 'Greeter',
			type: 'theme',
		});

		const pinned = await getAdminAddon(ctx, admin.caller, 'edit.reset');

		expect(pinned?.addon.pinned).toEqual({ name: true, description: false, type: true });
		expect(pinned?.form).toMatchObject({ name: 'Greeter', description: null, type: 'theme' });
		expect(pinned?.manifest).toEqual({
			name: 'Hello 1.0.0',
			description: 'Says hello in 1.0.0.',
			type: 'plugin',
		});

		const reset = await editAddon(ctx, admin.caller, 'edit.reset', {
			...(pinned?.form ?? (await formOf('edit.reset'))),
			name: null,
			type: null,
		});

		expect(reset.addon).toMatchObject({
			name: 'Hello 1.0.0',
			type: 'plugin',
			pinned: { name: false, description: false, type: false },
		});
	});

	test('a stale revision is an edit_conflict and writes nothing', async () => {
		await seedApprovedAddon(ctx, owner.userId, release('edit.stale', '1.0.0'));

		const stale = await formOf('edit.stale');

		await editAddon(ctx, admin.caller, 'edit.stale', { ...stale, name: 'First' });

		const events = await ctx.db.$count(moderationEvent);

		expect(
			await rejection(
				editAddon(ctx, admin.caller, 'edit.stale', { ...stale, name: 'Second' }),
			),
		).toMatchObject({ code: 'edit_conflict' });
		expect(await ctx.db.$count(moderationEvent)).toBe(events);
		expect((await displayed('edit.stale')).row.name).toBe('First');
	});

	test('records one event per changed group with the reason, and nothing for an unchanged submit', async () => {
		const helper = await signUp();

		await seedApprovedAddon(ctx, owner.userId, release('edit.events', '1.0.0'));

		const form = await formOf('edit.events');

		await editAddon(ctx, admin.caller, 'edit.events', form);

		expect(await eventsOf('edit.events')).toEqual([]);

		const view = await editAddon(ctx, admin.caller, 'edit.events', {
			...form,
			name: 'Greeter',
			repository: 'acme/greeter',
			delisted: true,
			maintainers: [
				{ userId: helper.userId, role: 'owner' },
				{ userId: owner.userId, role: 'maintainer' },
			],
			reason: 'Ownership handed over',
		});

		expect(
			(await eventsOf('edit.events')).map((event) => [
				event.kind,
				event.reason,
				event.actorId,
			]),
		).toEqual([
			['addon.edited', 'Ownership handed over', admin.userId],
			['addon.delisted', 'Ownership handed over', admin.userId],
			['addon.maintainers_changed', 'Ownership handed over', admin.userId],
		]);
		expect(view.events.items.at(-1)).toMatchObject({
			kind: 'addon.edited',
			data: {
				changes: [
					{ field: 'name', from: null, to: 'Greeter', pinned: true },
					{ field: 'repository', from: null, to: 'acme/greeter', pinned: false },
				],
			},
		});
		expect(view.addon).toMatchObject({ repository: 'acme/greeter' });
		expect(view.addon.delistedAt).not.toBeNull();
		expect(view.maintainers.map((member) => [member.id, member.role])).toEqual([
			[helper.userId, 'owner'],
			[owner.userId, 'maintainer'],
		]);
		expect(await getAddonDetails(ctx, 'edit.events')).toBeUndefined();
	});

	test('maintainer edits keep at least one owner and name only existing users', async () => {
		await seedApprovedAddon(ctx, owner.userId, release('edit.owners', '1.0.0'));

		const form = await formOf('edit.owners');
		const ownerless = { ...form, maintainers: [{ userId: owner.userId, role: 'maintainer' }] };

		expect(editAddonRequestSchema.safeParse(ownerless).success).toBe(false);
		expect(
			await rejection(
				editAddon(ctx, admin.caller, 'edit.owners', {
					...form,
					maintainers: [{ userId: owner.userId, role: 'maintainer' }],
				}),
			),
		).toMatchObject({ code: 'last_owner' });
		expect(
			await rejection(
				editAddon(ctx, admin.caller, 'edit.owners', {
					...form,
					maintainers: [...form.maintainers, { userId: 'nobody', role: 'owner' }],
				}),
			),
		).toMatchObject({ code: 'not_found' });
		expect((await formOf('edit.owners')).maintainers).toEqual([
			{ userId: owner.userId, role: 'owner' },
		]);
	});

	test('a moderator can delist through the form but not edit metadata or maintainers', async () => {
		await seedApprovedAddon(ctx, owner.userId, release('edit.moderator', '1.0.0'));

		const form = await formOf('edit.moderator', moderator.caller);

		expect(
			await rejection(
				editAddon(ctx, moderator.caller, 'edit.moderator', { ...form, name: 'Greeter' }),
			),
		).toMatchObject({ code: 'forbidden' });
		expect(
			await rejection(
				editAddon(ctx, moderator.caller, 'edit.moderator', {
					...form,
					maintainers: [{ userId: moderator.userId, role: 'owner' }],
				}),
			),
		).toMatchObject({ code: 'forbidden' });

		const delisted = await editAddon(ctx, moderator.caller, 'edit.moderator', {
			...form,
			delisted: true,
		});

		expect(delisted.addon.delistedAt).not.toBeNull();
		expect((await eventsOf('edit.moderator')).map((event) => event.kind)).toEqual([
			'addon.delisted',
		]);
		expect(await rejection(editAddon(ctx, owner.caller, 'edit.moderator', form))).toMatchObject(
			{
				code: 'forbidden',
			},
		);
	});
});

describe('edit migration', () => {
	test('backfills the repository from the newest approved submission that named one', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'ub-edit-'));
		const previous = join(directory, 'migrations');
		const applied = (await readdir(MIGRATIONS_FOLDER)).filter((name) => name < EDIT_MIGRATION);
		const db = createDatabase(join(directory, 'app.db'));

		try {
			for (const name of applied) {
				await cp(join(MIGRATIONS_FOLDER, name), join(previous, name), { recursive: true });
			}

			migrate(db, { migrationsFolder: previous });

			db.$client.run(`INSERT INTO user (id, name, email) VALUES ('u', 'U', 'u@example.com')`);
			db.$client.run(
				`INSERT INTO addon (id, type, name, description, updated_at) VALUES ('old.one', 'plugin', 'One', '', 0), ('old.none', 'plugin', 'None', '', 0)`,
			);

			const submissions = [
				['old.one', 'a', 'approved', 'acme/first', 1000],
				['old.one', 'b', 'approved', 'acme/newest', 2000],
				['old.one', 'c', 'approved', null, 3000],
				['old.one', 'd', 'rejected', 'evil/fork', 4000],
				['old.none', 'e', 'approved', null, 1000],
			] as const;

			for (const [addonId, id, status, repository, reviewedAt] of submissions) {
				db.$client.run(
					`INSERT INTO submission (id, addon_id, author_id, kind, status, version, manifest, repository, bundle_size, staging_key, upload_expires_at, created_at, reviewed_at)
					VALUES (?, ?, 'u', 'update', ?, '1.0.0', '{}', ?, 1, ?, 0, 0, ?)`,
					[id, addonId, status, repository, id, reviewedAt],
				);
			}

			migrateDatabase(db);

			const migrated = await db
				.select({ id: addon.id, repository: addon.repository })
				.from(addon)
				.orderBy(addon.id);

			expect(migrated).toEqual([
				{ id: 'old.none', repository: null },
				{ id: 'old.one', repository: 'acme/newest' },
			]);
		} finally {
			db.$client.close();
			await rm(directory, { recursive: true });
		}
	});
});
