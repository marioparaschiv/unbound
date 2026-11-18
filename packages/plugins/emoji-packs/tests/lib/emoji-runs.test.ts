import { describe, expect, test } from 'bun:test';

import { emojiRuns } from '~/lib/emoji-runs';

const shape = (text: string) =>
	emojiRuns(text).map(({ start, length, surrogates }) => [start, length, surrogates]);

describe('emojiRuns', () => {
	test('finds single emoji with UTF-16 offsets', () => {
		expect(shape('hi 😀 there 🔥')).toEqual([
			[3, 2, '😀'],
			[12, 2, '🔥'],
		]);
	});

	test('keeps joined sequences, skin tones and variation selectors together', () => {
		expect(shape('👨‍👩‍👧 👍🏽 ❤️')).toEqual([
			[0, 8, '👨‍👩‍👧'],
			[9, 4, '👍🏽'],
			[14, 2, '❤️'],
		]);
	});

	test('reads flags as pairs and keycaps as one emoji', () => {
		expect(shape('🇩🇪 1️⃣')).toEqual([
			[0, 4, '🇩🇪'],
			[5, 3, '1️⃣'],
		]);
	});

	test('leaves plain text, digits and punctuation alone', () => {
		expect(emojiRuns('plain text 123 #!')).toEqual([]);
	});
});
