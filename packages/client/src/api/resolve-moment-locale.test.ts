import { expect, test } from 'bun:test';

import resolveMomentLocale from './resolve-moment-locale';

test('prefers an exact locale match', () => {
	expect(resolveMomentLocale('en-US', ['en', 'en-us', 'en-gb'])).toBe('en-us');
});

test('falls back to the base language', () => {
	expect(resolveMomentLocale('de-AT', ['en', 'de', 'de-ch'])).toBe('de');
});

test('falls back to a regional locale for the same language', () => {
	expect(resolveMomentLocale('pt-PT', ['en', 'pt-br'])).toBe('pt-br');
});

test('uses English instead of retaining an unrelated locale', () => {
	expect(resolveMomentLocale('ar', ['en', 'hi'])).toBe('en');
});

test('uses English instead of selecting an unrelated available locale', () => {
	expect(resolveMomentLocale('en-US', ['ar'])).toBe('en');
});
