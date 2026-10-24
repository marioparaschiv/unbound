import { describe, expect, test } from 'bun:test';

import { languageLabel, searchLanguages } from './languages';

describe('languageLabel', () => {
	test('adds the native name when it differs', () => {
		expect(languageLabel({ code: 'de', name: 'German', nativeName: 'Deutsch' })).toBe(
			'German (Deutsch)',
		);
	});

	test('uses the name alone when there is no distinct native name', () => {
		expect(languageLabel({ code: 'en', name: 'English' })).toBe('English');
		expect(languageLabel({ code: 'x', name: 'Same', nativeName: 'Same' })).toBe('Same');
	});
});

describe('searchLanguages', () => {
	test('lists every language for a blank query, sorted by name', () => {
		const names = searchLanguages('  ').map(({ name }) => name);

		expect(names.length).toBe(35);
		expect(names).toEqual(names.toSorted((left, right) => left.localeCompare(right)));
	});

	test('matches code, name, or native name case-insensitively', () => {
		expect(searchLanguages('ZH').map(({ code }) => code)).toEqual(['zh']);
		expect(searchLanguages('German').map(({ code }) => code)).toEqual(['de']);
		expect(searchLanguages('日本').map(({ code }) => code)).toEqual(['ja']);
	});

	test('leads with auto detect regardless of the query', () => {
		const rows = searchLanguages('no such language', true);

		expect(rows).toEqual([{ code: 'auto', name: 'Auto detect' }]);
	});
});
