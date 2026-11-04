import { metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

type Draft = { content: string };

const sent: Draft[] = [];
const edited: Draft[] = [];
const MessageActions = {
	sendMessage: (_channelId: string, draft: Draft) => void sent.push(draft),
	editMessage: (_channelId: string, _messageId: string, draft: Draft) => void edited.push(draft),
	receiveMessage: () => {},
};

beforeEach(async () => {
	sent.length = 0;
	edited.length = 0;
	metro.register(MessageActions);
	await startPlugin();
});

describe('sending a message', () => {
	test('removes tracking parameters from its links', () => {
		MessageActions.sendMessage('c1', { content: 'https://example.com/a?utm_source=x&id=7' });

		expect(sent.at(-1)?.content).toBe('https://example.com/a?id=7');
	});

	test('leaves a message without links alone', () => {
		MessageActions.sendMessage('c1', { content: 'hello there' });

		expect(sent.at(-1)?.content).toBe('hello there');
	});
});

describe('editing a message', () => {
	test('removes tracking parameters from its links', () => {
		MessageActions.editMessage('c1', 'm1', { content: 'https://example.com/?fbclid=y' });

		expect(edited.at(-1)?.content).toBe('https://example.com/');
	});
});
