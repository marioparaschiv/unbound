import { afterEach, describe, expect, mock, test } from 'bun:test';

type PatchContext = {
	args: unknown[];
	original: (...args: unknown[]) => unknown;
	this: unknown;
};

type PatchHandler = (context: PatchContext) => unknown;

const replyState = new Map<string, string>();
const inserted: string[] = [];
const closed: string[] = [];
const messages = {
	sendMessage: (..._args: unknown[]): unknown => 'sent',
	editMessage: (): void => undefined,
};
const replies = {
	deletePendingReply: (channelId: string): void => {
		replyState.delete(channelId);
	},
};
const replyStore = {
	getPendingReply: (channelId: string): string | undefined => replyState.get(channelId),
};
const registry = {
	getBestActiveInputForChannelId: (channelId: string) => ({
		closeCustomKeyboard: () => closed.push(channelId),
		insertText: (value: string) => inserted.push(value),
	}),
};

function instead(target: object, name: string, handler: PatchHandler): () => void {
	const record = target as Record<string, (...args: unknown[]) => unknown>;
	const original = record[name];
	record[name] = function (...args: unknown[]): unknown {
		return handler({ args, original, this: this });
	};
	return () => {
		record[name] = original;
	};
}

mock.module('@unbound-app/api', () => ({
	metro: {
		findByProps: (...names: string[]) => {
			if (names.includes('sendMessage')) return messages;
			if (names.includes('deletePendingReply')) return replies;
			if (names.includes('getPendingReply')) return replyStore;
			if (names.includes('getBestActiveInputForChannelId')) return registry;
			return null;
		},
	},
	patcher: { instead },
}));

const { default: plugin } = await import('./index');

afterEach(() => {
	plugin.stop();
	replyState.clear();
	inserted.length = 0;
	closed.length = 0;
});

describe('GIF paste replies', () => {
	test('preserves a queued reply when the GIF picker clears it after selection', () => {
		replyState.set('channel', 'message');
		plugin.start();

		expect(
			messages.sendMessage(
				'channel',
				{ content: 'https://klipy.com/gifs/example' },
				undefined,
				{
					location: 'gif_reply',
				},
			),
		).toBeUndefined();
		replies.deletePendingReply('channel');

		expect(replyState.get('channel')).toBe('message');
		expect(inserted).toEqual(['https://klipy.com/gifs/example ']);
		expect(closed).toEqual(['channel']);
	});

	test('still clears replies normally outside a GIF paste', () => {
		replyState.set('channel', 'message');
		plugin.start();

		replies.deletePendingReply('channel');

		expect(replyState.has('channel')).toBe(false);
	});

	test('does not preserve a later unrelated reply cancellation', async () => {
		replyState.set('channel', 'message');
		plugin.start();

		messages.sendMessage('channel', { content: 'https://klipy.com/gifs/example' }, undefined, {
			location: 'gif_reply',
		});
		await Promise.resolve();
		replies.deletePendingReply('channel');

		expect(replyState.has('channel')).toBe(false);
	});

	test('leaves ordinary sends and reply cleanup unchanged', () => {
		replyState.set('channel', 'message');
		plugin.start();

		expect(messages.sendMessage('channel', { content: 'hello' })).toBe('sent');
		replies.deletePendingReply('channel');

		expect(replyState.has('channel')).toBe(false);
		expect(inserted).toEqual([]);
	});
});
