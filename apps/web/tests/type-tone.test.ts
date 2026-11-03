import { describe, expect, test } from 'bun:test';

import { getTypeTone, tokenizeType } from '~/lib/type-tone';

describe('type tones', () => {
	test('a keyword and its literals share a tone', () => {
		expect(getTypeTone('boolean')).toBe(getTypeTone('false'));
		expect(getTypeTone('string')).toBe(getTypeTone("'raw'"));
		expect(getTypeTone('number')).toBe(getTypeTone('-1.5'));
		expect(getTypeTone('undefined')).toBe(getTypeTone('void'));
	});

	test('a named type is a reference, and symbols are punctuation', () => {
		expect(getTypeTone('AddonAuthor')).toBe('reference');
		expect(getTypeTone('|')).toBe('punctuation');
	});

	test('tokens spell the type again, each in its tone', () => {
		const tokens = tokenizeType("string | { uri: string } | 'raw'");

		expect(tokens.map((token) => token.text).join('')).toBe("string | { uri: string } | 'raw'");
		expect(
			tokens.filter((token) => token.tone === 'string').map((token) => token.text),
		).toEqual(['string', 'string', "'raw'"]);
		expect(tokens.find((token) => token.text === 'uri')?.tone).toBe('property');
		expect(tokenizeType('NativeUIScope')[0]?.tone).toBe('reference');
	});
});
