import { flux } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { createMentionIndex } from '~/avatars/mention-index';
import { MAX_MENTION_REFRESHES } from '~/constants';

type TestMessage = { id: string; channel_id: string; content: string };

const messages: TestMessage[] = [];
const users = new Map<string, { id: string; username: string }>();
const looked: string[] = [];

// A message mentioning `mentioned`, or none; the user resolves once `resolve` has run for it.
function message(id: string, mentioned?: string): TestMessage {
	return { id, channel_id: 'c1', content: mentioned ? `hi <@${mentioned}>` : 'hi' };
}

function resolve(id: string) {
	users.set(id, { id, username: `user${id}` });
}

beforeEach(() => {
	messages.length = 0;
	users.clear();
	looked.length = 0;

	flux.seed({
		SelectedChannel: { getChannelId: () => 'c1' },
		Message: {
			getMessages: () => ({ _array: messages }),
			getMessage: (_channelId: string, id: string) =>
				messages.find((candidate) => candidate.id === id),
		},
		User: {
			getUser: (id: string) => {
				looked.push(id);

				return users.get(id);
			},
		},
		Channel: { getChannel: () => undefined },
		GuildMember: { getMember: () => undefined },
	});
});

describe('createMentionIndex', () => {
	test('indexes only new or changed messages when the channel grows', () => {
		const index = createMentionIndex(false);

		['1', '2', '3'].forEach(resolve);
		messages.push(message('1', '1'), message('2', '2'));
		index.hydrateChannel();
		messages.push(message('3', '3'));
		index.hydrateChannel();
		index.hydrateChannel();

		expect(looked).toEqual(['1', '2', '3']);
		expect(index.get('3')).toMatchObject([{ labels: ['user3'], type: 'user' }]);
	});

	test('reindexes an edited message that keeps its ID', () => {
		const index = createMentionIndex(false);

		['1', '2'].forEach(resolve);
		messages.push(message('1', '1'));
		index.hydrateChannel();
		messages[0] = message('1', '2');
		index.hydrateMessage('1', 'c1');

		expect(index.get('1')).toMatchObject([{ labels: ['user2'] }]);
	});

	test('treats a complete message without mentions as settled', () => {
		const index = createMentionIndex(false);

		messages.push(message('1'), message('2', '9'));
		index.hydrateChannel();

		expect(index.isSettledEmpty('1')).toBe(true);
		expect(index.isSettledEmpty('2')).toBe(false);
		expect(index.isSettledEmpty('3')).toBe(false);
	});

	test('reports only the targets whose mentions resolved', () => {
		const index = createMentionIndex(false);

		messages.push(message('1', '8'), message('2', '9'));
		index.hydrateChannel();
		resolve('9');

		const changed = index.refresh([{ id: '1' }, { id: '2' }]);

		expect([...changed]).toEqual(['2']);
		expect(index.isUnresolved('1')).toBe(true);
		expect(index.isUnresolved('2')).toBe(false);
	});

	test('stops retrying a mention that never resolves', () => {
		const index = createMentionIndex(false);

		messages.push(message('1', '8'));
		index.hydrateChannel();

		for (let attempt = 0; attempt < MAX_MENTION_REFRESHES + 5; attempt++) {
			index.refresh([{ id: '1' }]);
		}

		expect(index.exhausted('1')).toBe(true);
		expect(looked.length).toBe(MAX_MENTION_REFRESHES + 1);
		expect([...index.refresh([{ id: '1' }])]).toEqual([]);
		expect(looked.length).toBe(MAX_MENTION_REFRESHES + 1);
	});

	test('resolves an exhausted message when it is shown again', () => {
		const index = createMentionIndex(false);

		messages.push(message('1', '8'));
		index.hydrateChannel();

		for (let attempt = 0; attempt < MAX_MENTION_REFRESHES; attempt++) {
			index.refresh([{ id: '1' }]);
		}

		resolve('8');

		expect(index.exhausted('1')).toBe(true);
		expect(index.hydrateMessage('1', 'c1')).toBe(true);
		expect(index.isUnresolved('1')).toBe(false);
		expect(index.exhausted('1')).toBe(false);
		expect(index.get('1')).toHaveLength(1);
	});

	test('rechecks the selected channel without spending the retry cap', () => {
		const index = createMentionIndex(false);

		resolve('2');
		messages.push(message('1', '8'), message('2', '2'));
		index.hydrateChannel();

		for (let attempt = 0; attempt < MAX_MENTION_REFRESHES + 5; attempt++) {
			index.recheckChannel();
		}

		resolve('8');
		index.recheckChannel();

		expect(index.exhausted('1')).toBe(false);
		expect(index.get('1')).toHaveLength(1);
		expect(looked.filter((id) => id === '2')).toEqual(['2']);
	});

	test('recollects an unresolved message when it is seen again', () => {
		const index = createMentionIndex(false);

		messages.push(message('1', '8'));
		index.hydrateChannel();
		resolve('8');
		index.hydrateMessage('1', 'c1');

		expect(index.isUnresolved('1')).toBe(false);
		expect(index.get('1')).toHaveLength(1);
	});
});
