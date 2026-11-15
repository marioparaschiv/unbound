import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { createModeration, type Moderation } from '~/moderation/moderation';
import type { CaseDraft } from '~/moderation/cases';
import { modCase } from '~/db/schema';

import { createFakeDiscord, createFakeGateway, type FakeDiscord } from '../helpers/fake-discord';
import { createBotTestDatabase, DATABASE_URL, type BotTestDatabase } from '../helpers/database';

const DRAFT: CaseDraft = {
	action: 'warn',
	userId: '100',
	userName: 'spam_bot',
	moderatorId: '200',
	moderatorName: 'mod',
	reason: null,
};

describe.skipIf(!DATABASE_URL)('moderation', () => {
	let database: BotTestDatabase;
	let fake: FakeDiscord;
	let moderation: Moderation;

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	});

	beforeEach(async () => {
		await database.db.delete(modCase);
		fake = createFakeDiscord();
		moderation = createModeration({
			db: database.db,
			messages: createFakeGateway(fake),
			guildId: '1',
			logChannelId: fake.channelId,
			prefix: '!',
		});
	});

	afterEach(() => {
		fake.stop();
	});

	test('posts a recorded case to the mod log and keeps where', async () => {
		const entry = await moderation.record(DRAFT);

		expect(fake.requests).toHaveLength(1);
		expect(JSON.stringify(fake.requests[0])).toContain(`Case ${entry.id} · mod`);
		expect(entry.logChannelId).toBe(fake.channelId);
		expect(entry.logMessageId).toBe(fake.messages[0]?.id ?? '');
	});

	test('edits the post when the reason is set or the warning pardoned', async () => {
		const entry = await moderation.record(DRAFT);
		const reasoned = await moderation.setReason(entry, 'Posting scams');
		const pardoned = await moderation.pardon(reasoned);

		expect(pardoned.reason).toBe('Posting scams');
		expect(pardoned.closedAt).toBeInstanceOf(Date);
		expect(fake.edits).toHaveLength(2);
		expect(JSON.stringify(fake.edits[1])).toContain('pardoned <t:');
	});

	test('stores the case without a post while no mod log channel is set', async () => {
		const unposted = createModeration({
			db: database.db,
			messages: createFakeGateway(fake),
			guildId: '1',
			logChannelId: undefined,
			prefix: '!',
		});
		const entry = await unposted.record(DRAFT);

		expect(fake.requests).toHaveLength(0);
		expect(entry.logMessageId).toBeNull();
	});

	test('DMs the user, and reports a closed DM as undelivered', async () => {
		const notice = {
			action: 'warn',
			reason: 'Spam',
			moderatorId: '200',
			moderatorName: 'mod',
			createdAt: new Date(),
			expiresAt: null,
		} as const;

		expect(await moderation.notify('100', notice, 'Unbound')).toBe(true);
		expect(fake.dms('100')).toHaveLength(1);
		expect(JSON.stringify(fake.requests.at(-1))).toContain('You were warned in Unbound');

		fake.closedDms.add('300');

		expect(await moderation.notify('300', notice, 'Unbound')).toBe(false);
	});
});
