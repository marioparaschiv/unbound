import { describe, expect, test } from 'bun:test';

import { furiganaLine, needsFurigana } from '~/lib/furigana';

describe('furigana', () => {
	test('reads Japanese with kanji, not Chinese or kana alone', () => {
		expect(needsFurigana('東京に行きます')).toBe(true);
		expect(needsFurigana('我爱你')).toBe(false);
		expect(needsFurigana('ありがとう')).toBe(false);
	});

	test('brackets the reading after each word with kanji', () => {
		const text = '東京で日本語を勉強しています';

		expect(
			furiganaLine(text, [
				{ start: 0, length: 2, reading: 'とうきょう' },
				{ start: 2, length: 1, reading: 'で' },
				{ start: 3, length: 2, reading: 'にっぽん' },
				{ start: 5, length: 1, reading: 'ご' },
				{ start: 6, length: 1, reading: 'を' },
				{ start: 7, length: 2, reading: 'べんきょう' },
				{ start: 9, length: 5, reading: 'しています' },
			]),
		).toBe('東京(とうきょう)で日本(にっぽん)語(ご)を勉強(べんきょう)しています');
	});

	test('keeps kana the word shares with its reading outside the brackets', () => {
		expect(furiganaLine('行きます', [{ start: 0, length: 4, reading: 'いきます' }])).toBe(
			'行(い)きます',
		);
	});

	test('keeps text between tokens', () => {
		expect(
			furiganaLine('今日、晴れ', [
				{ start: 0, length: 2, reading: 'きょう' },
				{ start: 3, length: 2, reading: 'はれ' },
			]),
		).toBe('今日(きょう)、晴(は)れ');
	});
});
