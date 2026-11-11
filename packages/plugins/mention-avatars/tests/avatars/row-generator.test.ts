import { flux, metro } from '@unbound-app/api/testing';
import { beforeEach, expect, test } from 'bun:test';

import { createMentionIndex } from '~/avatars/mention-index';
import { patchRowGenerator } from '~/avatars/patches/row-generator';

const rowGenerator = {
	generateMessageRowData: (_input: unknown) => ({}),
};

beforeEach(() => {
	flux.seed({
		User: {
			getUser: (id: string) => ({
				id,
				username: 'wumpus',
				avatar: 'abc',
			}),
		},
		Channel: { getChannel: () => ({ guild_id: 'g1' }) },
		GuildMember: { getMember: () => undefined, getNick: () => undefined },
	});
	metro.register(rowGenerator);
});

test('indexes the mentions of each message Discord builds a row for', () => {
	const index = createMentionIndex(false);

	patchRowGenerator(index);
	rowGenerator.generateMessageRowData({
		message: { id: 'm1', channel_id: 'c1', content: 'hi <@42>' },
	});

	expect(index.get('m1')).toMatchObject([
		{
			type: 'user',
			avatarURL: 'https://cdn.discordapp.com/avatars/42/abc.png?size=32',
		},
	]);
});

test('has nothing for a message without mentions', () => {
	const index = createMentionIndex(false);

	patchRowGenerator(index);
	rowGenerator.generateMessageRowData({
		message: { id: 'm2', channel_id: 'c1', content: 'hello' },
	});

	expect(index.get('m2')).toEqual([]);
	expect(index.isSettledEmpty('m2')).toBe(true);
});
