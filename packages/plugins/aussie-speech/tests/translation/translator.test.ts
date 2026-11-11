import { expect, test } from 'bun:test';

import { australianSpellings, mappings } from '~/translation/lexicon';
import { translate } from '~/translation/translator';

test('keeps the lexicon lowercase with distinct mappings and sources', () => {
	const sources = mappings.map(([source]) => source);
	expect(sources.every((source) => source === source.toLowerCase())).toBe(true);
	expect(
		mappings.every(
			([source, replacement]) => source.toLowerCase() !== replacement.toLowerCase(),
		),
	).toBe(true);
	expect(new Set(sources).size).toBe(sources.length);
	expect(
		Object.keys(australianSpellings).every((source) => source === source.toLowerCase()),
	).toBe(true);
});

test('uses the exaggerated larrikin register', () => {
	expect(translate('I am exhausted after work, can we get dinner tonight?')).toBe(
		"I'm absolutely rooted after graft, can we get tea tonight?",
	);
});

test('handles direct words, spelling, and plural forms', () => {
	expect(translate('My favorite color is great. I bought cookies and French fries.')).toBe(
		"Me favourite colour is grouse. I bought bikkies 'n Hot chips.",
	);
});

test('preserves case, punctuation, URLs, Discord markup, and code', () => {
	expect(translate('cOoL, favorite! ```very good``` https://example.com/color <@123>')).toBe(
		'hEaPS GOOD, favourite! ```very good``` https://example.com/color <@123>',
	);
});

test('includes the researched Australian idioms', () => {
	expect(translate('Hurry up! Very impressive! Inside information. I am very full.')).toBe(
		"Rattle your dags! The ant's pants! The oil. I'm full as a goog.",
	);
});
