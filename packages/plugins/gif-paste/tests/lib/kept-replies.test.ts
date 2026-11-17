import { describe, expect, test } from 'bun:test';

import { createKeptReplies } from '~/lib/kept-replies';

describe('createKeptReplies', () => {
	test('keeps a reply through every clear the picker makes right after a selection', () => {
		const replies = createKeptReplies(() => 1000);

		replies.keep('channel');

		expect(replies.isKept('channel')).toBe(true);
		expect(replies.isKept('channel')).toBe(true);
	});

	test('lets a later, unrelated clear through', () => {
		let time = 1000;
		const replies = createKeptReplies(() => time);

		replies.keep('channel');
		time += 2500;

		expect(replies.isKept('channel')).toBe(false);
	});

	test('only keeps replies in the selected channel', () => {
		const replies = createKeptReplies(() => 1000);

		replies.keep('channel');

		expect(replies.isKept('other')).toBe(false);
		expect(replies.isKept(undefined)).toBe(false);
	});
});
