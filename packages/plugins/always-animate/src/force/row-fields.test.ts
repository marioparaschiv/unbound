import { describe, expect, test } from 'bun:test';

import { rowMessageId, withRowFields } from '~/force/row-fields';

describe('withRowFields', () => {
	test('overrides row options and keeps the rest', () => {
		const data = { message: { id: '1' } };
		const options = { animateEmoji: false, gifAutoPlay: false, renderEmbeds: true };
		const [nextData, nextOptions, extra] = withRowFields([data, options, 'extra'], {
			animateEmoji: true,
		});

		expect(nextData).toBe(data);
		expect(nextOptions).toEqual({ animateEmoji: true, gifAutoPlay: false, renderEmbeds: true });
		expect(extra).toBe('extra');
		expect(options.animateEmoji).toBe(false);
	});

	test('leaves calls without row options alone', () => {
		const data = { message: { id: '1' } };

		expect(withRowFields([data], { animateEmoji: true })).toEqual([data]);
		expect(withRowFields([data, null], { animateEmoji: true })).toEqual([data, null]);
	});
});

describe('rowMessageId', () => {
	test("reads the row's message id", () => {
		expect(rowMessageId({ message: { id: '123' } })).toBe('123');
	});

	test('ignores rows without a message id', () => {
		expect(rowMessageId(undefined)).toBeUndefined();
		expect(rowMessageId({})).toBeUndefined();
		expect(rowMessageId({ message: { id: 123 } })).toBeUndefined();
	});
});
