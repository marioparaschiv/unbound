import { describe, expect, test } from 'bun:test';

import { mentionOnKeyword, type MentionRules } from '~/lib/mentions';

const rules: MentionRules = {
	currentUserId: '1',
	ignoreBots: true,
	matches: (text) => text.includes('unbound'),
};

describe('keyword mentions', () => {
	test("adds the current user to a matching message's mentions once", () => {
		const message = { content: 'unbound is up', author: { id: '2' }, mentions: [{ id: '3' }] };

		expect(mentionOnKeyword(message, rules)).toBe(true);
		expect(mentionOnKeyword(message, rules)).toBe(false);
		expect(message.mentions).toEqual([{ id: '3' }, { id: '1' }]);
	});

	test('reads embed titles and descriptions', () => {
		const message = {
			author: { id: '2' },
			embeds: [{ title: 'News', description: 'unbound 3.4' }],
		};

		expect(mentionOnKeyword(message, rules)).toBe(true);
	});

	test('skips own messages, bots and messages without a keyword', () => {
		expect(mentionOnKeyword({ content: 'unbound', author: { id: '1' } }, rules)).toBe(false);
		expect(
			mentionOnKeyword({ content: 'unbound', author: { id: '2', bot: true } }, rules),
		).toBe(false);
		expect(mentionOnKeyword({ content: 'discord', author: { id: '2' } }, rules)).toBe(false);
		expect(mentionOnKeyword(undefined, rules)).toBe(false);
	});
});
