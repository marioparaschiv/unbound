import { describe, expect, test } from 'bun:test';

import { createKeptReplies } from './kept-replies';

describe('createKeptReplies', () => {
	test('keeps a reply for the clear that follows a GIF selection, once', () => {
		const replies = createKeptReplies();

		replies.keep('channel');

		expect(replies.release('channel')).toBe(true);
		expect(replies.release('channel')).toBe(false);
	});

	test('does not keep a reply for a later, unrelated clear', async () => {
		const replies = createKeptReplies();

		replies.keep('channel');
		await Promise.resolve();

		expect(replies.release('channel')).toBe(false);
	});

	test('only keeps replies in the selected channel', () => {
		const replies = createKeptReplies();

		replies.keep('channel');

		expect(replies.release('other')).toBe(false);
	});
});
