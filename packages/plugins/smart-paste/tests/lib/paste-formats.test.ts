import { describe, expect, test } from 'bun:test';

import { asCodeBlock, asPlainText, asQuote, formatsFor, singleLink } from '~/lib/paste-formats';

describe('paste formats', () => {
	test('escapes markdown in plain text', () => {
		expect(asPlainText('**bold** _x_ `y`')).toBe('\\*\\*bold\\*\\* \\_x\\_ \\`y\\`');
	});

	test('fences code longer than any backticks inside', () => {
		expect(asCodeBlock('a ```b``` c\n')).toBe('````\na ```b``` c\n````');
		expect(asCodeBlock('x')).toBe('```\nx\n```');
	});

	test('quotes every line', () => {
		expect(asQuote('one\ntwo\n')).toBe('> one\n> two');
	});

	test('recognises a single link', () => {
		expect(singleLink(' https://example.com/a?b=c ')).toBe('https://example.com/a?b=c');
		expect(singleLink('see https://example.com')).toBeUndefined();
	});

	test('offers formats that suit the clipboard', () => {
		expect(formatsFor('https://example.com')).toEqual(['link', 'plain', 'quote']);
		expect(formatsFor('word')).toEqual(['plain', 'code', 'quote']);
		expect(formatsFor('line\nline')).toEqual(['plain', 'code', 'quote', 'file']);
	});
});
