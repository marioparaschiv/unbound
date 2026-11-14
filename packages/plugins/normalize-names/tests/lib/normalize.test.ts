import { describe, expect, test } from 'bun:test';

import { normalizeName } from '~/lib/normalize';

describe('normalizeName', () => {
	test('folds styled letters to plain ones', () => {
		expect(normalizeName('𝓯𝓪𝓷𝓬𝔂')).toBe('fancy');
		expect(normalizeName('ｗｉｄｅ')).toBe('wide');
		expect(normalizeName('ⓒⓘⓡⓒⓛⓔ')).toBe('circle');
		expect(normalizeName('ᴛɪɴʏ ᴄᴀᴘꜱ')).toBe('tiny caps');
		expect(normalizeName('𝐁𝐨𝐥𝐝 𝟏𝟐𝟑')).toBe('Bold 123');
	});

	test('drops stacked combining marks but keeps accents', () => {
		expect(normalizeName('z̷̢̛͓a̸̛͎l̶̰g̴o̷')).toBe('zalgo');
		expect(normalizeName('José Müller')).toBe('José Müller');
	});

	test('keeps names that would end up empty or unreadable', () => {
		expect(normalizeName('✨✨')).toBe('✨✨');
		expect(normalizeName('adrián')).toBe('adrián');
	});
});
