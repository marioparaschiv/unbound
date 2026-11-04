import { metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';

const channelId = 'channel';
const gifSelection = [
	channelId,
	{ content: 'https://tenor.com/cat' },
	{},
	{ location: 'gif_reply' },
] as const;

const composer = { text: '', keyboardClosed: false, hasInput: true };
const reply = { pending: true as boolean, sent: [] as unknown[][] };

const messages = {
	sendMessage: (...args: unknown[]) => void reply.sent.push(args),
	receiveMessage: () => {},
};
const replies = { deletePendingReply: (_channelId: string) => void (reply.pending = false) };

beforeEach(async () => {
	composer.text = '';
	composer.keyboardClosed = false;
	composer.hasInput = true;
	reply.pending = true;
	reply.sent = [];

	metro.register(messages);
	metro.register(replies);
	metro.register({ getPendingReply: () => (reply.pending ? { channelId } : undefined) });
	metro.register({
		getBestActiveInputForChannelId: () =>
			composer.hasInput
				? {
						insertText: (text: string) => void (composer.text += text),
						closeCustomKeyboard: () => void (composer.keyboardClosed = true),
					}
				: undefined,
	});
	await startPlugin();
});

describe('selecting a GIF from a reply', () => {
	test('pastes the link into the composer instead of sending it', () => {
		messages.sendMessage(...gifSelection);

		expect(composer.text).toBe('https://tenor.com/cat ');
		expect(composer.keyboardClosed).toBe(true);
		expect(reply.sent).toEqual([]);
	});

	test('keeps the pending reply when the picker clears it right after', () => {
		messages.sendMessage(...gifSelection);
		replies.deletePendingReply(channelId);

		expect(reply.pending).toBe(true);
	});

	test('sends as Discord would when the composer is not open', () => {
		composer.hasInput = false;
		messages.sendMessage(...gifSelection);

		expect(reply.sent).toEqual([[...gifSelection]]);
	});

	test('leaves other messages and reply clears alone', () => {
		messages.sendMessage(channelId, { content: 'hi' }, {}, { location: 'chat' });
		replies.deletePendingReply(channelId);

		expect(reply.sent).toHaveLength(1);
		expect(composer.text).toBe('');
		expect(reply.pending).toBe(false);
	});
});

describe('starting', () => {
	test('reports both patches as applied', async () => {
		expect((await selfTest()).ok).toBe(true);
	});
});
