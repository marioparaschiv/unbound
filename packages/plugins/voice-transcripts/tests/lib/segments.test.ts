import { describe, expect, test } from 'bun:test';

import { formatTime, groupWords } from '~/lib/segments';

const word = (text: string, start: number) => ({ text, start, duration: 0.3 });

describe('groupWords', () => {
	test('ends passages at sentences and pauses', () => {
		expect(
			groupWords([
				word('Hello', 0),
				word('there.', 0.4),
				word('This', 0.9),
				word('is', 1.2),
				word('later', 3),
			]),
		).toEqual([
			{ start: 0, text: 'Hello there.' },
			{ start: 0.9, text: 'This is' },
			{ start: 3, text: 'later' },
		]);
	});

	test('caps passages at 10 words', () => {
		const words = Array.from({ length: 20 }, (_, index) => word('w', index * 0.3));

		expect(groupWords(words).map((segment) => segment.text.split(' ').length)).toEqual([
			10, 10,
		]);
	});
});

describe('formatTime', () => {
	test('writes minutes and seconds', () => {
		expect(formatTime(7.9)).toBe('0:07');
		expect(formatTime(65)).toBe('1:05');
	});
});
