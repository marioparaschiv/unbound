import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { MAX_MENTION_REFRESHES } from '~/constants';

type TestMessage = { id: string; channel_id: string; content: string };

const messages: TestMessage[] = [];
const resolvable = new Set<string>();
const collected: string[] = [];

mock.module('~/avatars/modules', () => ({
	SelectedChannelStore: { getChannelId: () => 'c1' },
	MessageStore: {
		getMessages: () => ({ _array: messages }),
		getMessage: (_channelId: string, id: string) =>
			messages.find((message) => message.id === id),
	},
}));

mock.module('~/avatars/resolve-mentions', () => ({
	collectMentions: (message: TestMessage) => {
		collected.push(message.id);

		const complete = !message.content.includes('@') || resolvable.has(message.id);

		return {
			complete,
			mentions: complete && message.content.includes('@') ? [{ label: message.content }] : [],
		};
	},
}));

const { createMentionIndex } = await import('~/avatars/mention-index');

function message(id: string, content = 'hi'): TestMessage {
	return { id, channel_id: 'c1', content };
}

beforeEach(() => {
	messages.length = 0;
	resolvable.clear();
	collected.length = 0;
});

describe('createMentionIndex', () => {
	test('indexes only new or changed messages when the channel grows', () => {
		const index = createMentionIndex(false);

		messages.push(message('1'), message('2'));
		index.hydrateChannel();
		messages.push(message('3'));
		index.hydrateChannel();
		index.hydrateChannel();

		expect(collected).toEqual(['1', '2', '3']);
	});

	test('reindexes an edited message that keeps its ID', () => {
		const index = createMentionIndex(false);

		messages.push(message('1'));
		index.hydrateChannel();
		messages[0] = message('1', '@someone');
		resolvable.add('1');
		index.hydrateMessage('1', 'c1');

		expect(collected).toEqual(['1', '1']);
		expect(index.get('1')).toHaveLength(1);
	});

	test('treats a complete message without mentions as settled', () => {
		const index = createMentionIndex(false);

		messages.push(message('1'), message('2', '@ghost'));
		index.hydrateChannel();

		expect(index.isSettledEmpty('1')).toBe(true);
		expect(index.isSettledEmpty('2')).toBe(false);
		expect(index.isSettledEmpty('3')).toBe(false);
	});

	test('reports only the targets whose mentions resolved', () => {
		const index = createMentionIndex(false);

		messages.push(message('1', '@a'), message('2', '@b'));
		index.hydrateChannel();
		resolvable.add('2');

		const changed = index.refresh([{ id: '1' }, { id: '2' }]);

		expect([...changed]).toEqual(['2']);
		expect(index.isUnresolved('1')).toBe(true);
		expect(index.isUnresolved('2')).toBe(false);
	});

	test('stops retrying a mention that never resolves', () => {
		const index = createMentionIndex(false);

		messages.push(message('1', '@ghost'));
		index.hydrateChannel();

		for (let attempt = 0; attempt < MAX_MENTION_REFRESHES + 5; attempt++) {
			index.refresh([{ id: '1' }]);
		}

		expect(index.exhausted('1')).toBe(true);
		expect(collected.length).toBe(MAX_MENTION_REFRESHES + 1);
		expect([...index.refresh([{ id: '1' }])]).toEqual([]);
		expect(collected.length).toBe(MAX_MENTION_REFRESHES + 1);
	});

	test('resolves an exhausted message when it is shown again', () => {
		const index = createMentionIndex(false);

		messages.push(message('1', '@late'));
		index.hydrateChannel();

		for (let attempt = 0; attempt < MAX_MENTION_REFRESHES; attempt++) {
			index.refresh([{ id: '1' }]);
		}

		resolvable.add('1');

		expect(index.exhausted('1')).toBe(true);
		expect(index.hydrateMessage('1', 'c1')).toBe(true);
		expect(index.isUnresolved('1')).toBe(false);
		expect(index.exhausted('1')).toBe(false);
		expect(index.get('1')).toHaveLength(1);
	});

	test('rechecks the selected channel without spending the retry cap', () => {
		const index = createMentionIndex(false);

		messages.push(message('1', '@late'), message('2'));
		index.hydrateChannel();

		for (let attempt = 0; attempt < MAX_MENTION_REFRESHES + 5; attempt++) {
			index.recheckChannel();
		}

		resolvable.add('1');
		index.recheckChannel();

		expect(index.exhausted('1')).toBe(false);
		expect(index.get('1')).toHaveLength(1);
		expect(collected.filter((id) => id === '2')).toEqual(['2']);
	});

	test('recollects an unresolved message when it is seen again', () => {
		const index = createMentionIndex(false);

		messages.push(message('1', '@later'));
		index.hydrateChannel();
		resolvable.add('1');
		index.hydrateMessage('1', 'c1');

		expect(index.isUnresolved('1')).toBe(false);
		expect(index.get('1')).toHaveLength(1);
	});
});
