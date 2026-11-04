import { metro, startPlugin } from '@unbound-app/api/testing';
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { storage } from '@unbound-app/api';

import { RULES_CHANNEL_ID } from '~/constants';

// The testing kit has no fake of `ui`, so the settings panel cannot load here.
mock.module(new URL('../src/components/settings-panel.tsx', import.meta.url).pathname, () => ({
	default: () => null,
}));

type Sent = { channelId: string; content: string };

const sent: Sent[] = [];
const Messages = {
	sendMessage: (channelId: string, message: { content: string }) =>
		sent.push({ channelId, content: message.content }),
	receiveMessage: () => {},
};

function rule(find: string, replace: string, onlyIfIncludes = '') {
	return { id: find, find, replace, onlyIfIncludes };
}

beforeAll(() => {
	metro.register(Messages);
});

beforeEach(() => {
	sent.length = 0;
});

describe('outgoing messages', () => {
	test('replace text and regex matches', async () => {
		const bucket = storage.getBucket();

		bucket.set('stringRules', [rule('teh', 'the')]);
		bucket.set('regexRules', [rule('/c(a+)t/gi', 'dog')]);
		await startPlugin();

		Messages.sendMessage('1', { content: 'teh caaat' });

		expect(sent).toEqual([{ channelId: '1', content: 'the dog' }]);
	});

	test('apply a rule only when the message contains its condition', async () => {
		storage.getBucket().set('stringRules', [rule('cat', 'dog', 'pets')]);
		await startPlugin();

		Messages.sendMessage('1', { content: 'cat' });
		Messages.sendMessage('1', { content: 'cat pets' });

		expect(sent.map((message) => message.content)).toEqual(['cat', 'dog pets']);
	});

	test('leave messages to the shared rules channel alone', async () => {
		storage.getBucket().set('stringRules', [rule('teh', 'the')]);
		await startPlugin();

		Messages.sendMessage(RULES_CHANNEL_ID, { content: 'teh' });

		expect(sent).toEqual([{ channelId: RULES_CHANNEL_ID, content: 'teh' }]);
	});

	test('give stored rules an id when the plugin starts', async () => {
		const bucket = storage.getBucket();

		bucket.set('stringRules', [{ find: 'teh', replace: 'the' }]);
		await startPlugin();

		expect(bucket.get('stringRules', [])).toMatchObject([
			{ find: 'teh', id: expect.any(String) },
		]);
	});
});
