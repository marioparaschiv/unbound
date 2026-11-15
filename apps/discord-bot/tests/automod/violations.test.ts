import { describe, expect, test } from 'bun:test';

import { findViolation, type MessageFacts } from '~/automod/violations';
import { AUTOMOD, type AutomodConfig } from '~/automod/config';
import { createRateCounter } from '~/lib/automod-rules';

const FACTS: MessageFacts = {
	userId: '100',
	channelId: '10',
	parentId: '1',
	roleIds: [],
	content: 'hello',
	mentionCount: 0,
	attachmentCount: 0,
};
const FOREIGN = new Set(['other']);

function check(facts: Partial<MessageFacts>, config: AutomodConfig = AUTOMOD, now = 0) {
	return findViolation(
		{ ...FACTS, ...facts },
		{
			config,
			counter: createRateCounter(),
			now,
			isForeignInvite: (code) => Promise.resolve(FOREIGN.has(code)),
		},
	);
}

describe("findViolation with Carl-bot's settings", () => {
	test('deletes an invite to another server, and allows one to this server', async () => {
		expect(await check({ content: 'discord.gg/other' })).toEqual({
			rule: 'Invite to another server',
			punishments: ['delete'],
		});
		expect(await check({ content: 'discord.gg/unbound' })).toBeUndefined();
	});

	test('leaves the rules Carl-bot had at zero switched off', async () => {
		expect(
			await check({ content: 'A'.repeat(500), mentionCount: 50, attachmentCount: 50 }),
		).toBeUndefined();
	});
});

describe('findViolation with rules switched on', () => {
	const config: AutomodConfig = {
		...AUTOMOD,
		allowedChannelIds: ['2'],
		honeypot: { channelIds: ['99'], punishments: ['ban'] },
		badWords: { words: ['scam'], punishments: ['delete', 'dm'] },
		caps: { limit: 10, punishments: ['delete'] },
		attachments: { rate: { count: 3, seconds: 10 }, purgeDays: 1, punishments: ['ban'] },
	};

	test('punishes any message in a honeypot channel first', async () => {
		expect(await check({ channelId: '99', content: 'discord.gg/other' }, config)).toEqual({
			rule: 'Honeypot channel',
			punishments: ['ban'],
		});
	});

	test('finds bad words and shouting', async () => {
		expect((await check({ content: 'free s-c-a-m' }, config))?.rule).toBe('Bad word');
		expect((await check({ content: 'STOP SHOUTING' }, config))?.rule).toBe(
			'Too many capital letters',
		);
	});

	test('bans attachment spam with its purge days', async () => {
		expect(await check({ attachmentCount: 3 }, config)).toEqual({
			rule: 'Attachment spam',
			punishments: ['ban'],
			purgeDays: 1,
		});
	});

	test('ignores allowed categories', async () => {
		expect(await check({ parentId: '2', content: 'scam' }, config)).toBeUndefined();
	});
});
