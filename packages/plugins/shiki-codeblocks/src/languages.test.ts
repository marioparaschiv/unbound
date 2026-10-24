import { describe, expect, test } from 'bun:test';

import { languageLabel, resolveLanguage } from './languages';

describe('resolveLanguage', () => {
	test('resolves aliases case-insensitively', () => {
		expect(resolveLanguage('TS')).toBe('typescript');
		expect(resolveLanguage('js')).toBe('javascript');
		expect(resolveLanguage(' yml ')).toBe('yaml');
	});

	test('does not resolve unknown languages', () => {
		expect(resolveLanguage('brainfuck')).toBeNull();
		expect(resolveLanguage('')).toBeNull();
	});
});

describe('languageLabel', () => {
	test('names bundled and Highlight.js-only languages', () => {
		expect(languageLabel('cpp')).toBe('C++');
		expect(languageLabel('php-template')).toBe('PHP template');
		expect(languageLabel('made-up')).toBe('made-up');
	});
});
