import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { insertCase, listCases, listDueBans, type CaseDraft } from '~/moderation/cases';
import { modCase } from '~/db/schema';

import { createBotTestDatabase, DATABASE_URL, type BotTestDatabase } from '../helpers/database';

const DRAFT: CaseDraft = {
	action: 'ban',
	userId: '100',
	userName: 'spam_bot',
	moderatorId: '200',
	moderatorName: 'mod',
	reason: null,
};
const HOUR = 3_600_000;

describe.skipIf(!DATABASE_URL)('moderation cases', () => {
	let database: BotTestDatabase;

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	});

	beforeEach(async () => {
		await database.db.delete(modCase);
	});

	test("numbers cases in order and lists a user's newest first, by action", async () => {
		const { db } = database;
		const warn = await insertCase(db, { ...DRAFT, action: 'warn' });
		const kick = await insertCase(db, { ...DRAFT, action: 'kick' });

		await insertCase(db, { ...DRAFT, action: 'warn', userId: '300' });

		// Numbering continues Carl-bot's last case, 2727.
		expect(warn.id).toBeGreaterThanOrEqual(2728);
		expect(kick.id).toBe(warn.id + 1);
		expect((await listCases(db, '100')).map(({ id }) => id)).toEqual([kick.id, warn.id]);
		expect((await listCases(db, '100', 'warn')).map(({ id }) => id)).toEqual([warn.id]);
	});

	test('lists only the open temporary bans whose time is up', async () => {
		const { db } = database;
		const now = new Date();
		const due = await insertCase(db, { ...DRAFT, expiresAt: new Date(now.getTime() - HOUR) });

		await insertCase(db, {
			...DRAFT,
			userId: '300',
			expiresAt: new Date(now.getTime() + HOUR),
		});
		await insertCase(db, { ...DRAFT, userId: '400' });

		expect((await listDueBans(db, now)).map(({ id }) => id)).toEqual([due.id]);
	});

	test('closes the open bans of a user banned again or unbanned', async () => {
		const { db } = database;
		const now = new Date();

		await insertCase(db, { ...DRAFT, expiresAt: new Date(now.getTime() - HOUR) });
		await insertCase(db, {
			...DRAFT,
			userId: '300',
			expiresAt: new Date(now.getTime() - HOUR),
		});
		await insertCase(db, { ...DRAFT, action: 'unban' });
		const reban = await insertCase(db, { ...DRAFT, userId: '300' });

		expect(await listDueBans(db, now)).toEqual([]);
		expect(reban.closedAt).toBeNull();
	});
});
