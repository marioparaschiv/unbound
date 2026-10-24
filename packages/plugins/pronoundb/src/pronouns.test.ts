import { describe, expect, test } from 'bun:test';

import { cleanProfilePronouns, formatPronouns, pickPronouns, shortenPronouns } from './pronouns';

describe('formatPronouns', () => {
	test('labels a single pronoun set in the chosen case', () => {
		expect(formatPronouns(['he'], false)).toBe('he/him');
		expect(formatPronouns(['he'], true)).toBe('He/Him');
	});

	test('joins several sets', () => {
		expect(formatPronouns(['she', 'they'], false)).toBe('she/they');
		expect(formatPronouns(['she', 'they'], true)).toBe('She/They');
	});

	test('keeps sentence labels capitalized', () => {
		expect(formatPronouns(['avoid'], false)).toBe('Avoid pronouns, use my name');
	});

	test('passes unknown codes through and returns null for no pronouns', () => {
		expect(formatPronouns(['xe'], false)).toBe('xe');
		expect(formatPronouns([], false)).toBeNull();
		expect(formatPronouns(undefined, true)).toBeNull();
	});
});

test('cleans a profile pronouns field to one line', () => {
	expect(cleanProfilePronouns('  he/\nhim ')).toBe('he/him');
	expect(cleanProfilePronouns('   ')).toBeUndefined();
});

test('picks the preferred source and falls back to the other', () => {
	expect(pickPronouns('he/him', 'they/them', false)).toBe('they/them');
	expect(pickPronouns('he/him', 'they/them', true)).toBe('he/him');
	expect(pickPronouns(undefined, 'they/them', true)).toBe('they/them');
	expect(pickPronouns(undefined, null, false)).toBeNull();
});

test('shortens pronouns to their first part and at most 12 characters', () => {
	expect(shortenPronouns('he/him • ISTP')).toBe('he/him');
	expect(shortenPronouns('Avoid pronouns, use my name')).toBe('Avoid prono…');
});
