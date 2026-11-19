import { describe, expect, test } from 'bun:test';

import { applyFixes, fixStepByStep, readMistakes, type Mistake } from '~/lib/languagetool';

const PAYLOAD = {
	matches: [
		{
			offset: 21,
			length: 3,
			message: 'Spelling',
			replacements: [{ value: 'the' }, { value: 'ten' }],
		},
		{ offset: 5, length: 3, message: 'Verb', replacements: [{ value: 'is' }] },
		{ offset: 0, length: 4, message: 'No fix', replacements: [] },
		{ offset: 'x' },
	],
};

describe('readMistakes', () => {
	test('reads matches in text order with their first fix', () => {
		expect(readMistakes(PAYLOAD)).toEqual([
			{ offset: 0, length: 4, message: 'No fix' },
			{ offset: 5, length: 3, message: 'Verb', fix: 'is' },
			{ offset: 21, length: 3, message: 'Spelling', fix: 'the' },
		]);
		expect(readMistakes(null)).toEqual([]);
	});
});

describe('applyFixes', () => {
	test('fixes from the end so offsets stay right', () => {
		expect(applyFixes('This are a test with teh mistake.', readMistakes(PAYLOAD))).toBe(
			'This is a test with the mistake.',
		);
	});

	test('skips a fix that overlaps a later one', () => {
		expect(
			applyFixes('abcdef', [
				{ offset: 1, length: 3, message: '', fix: 'X' },
				{ offset: 2, length: 3, message: '', fix: 'Y' },
			]),
		).toBe('abYf');
	});
});

describe('fixStepByStep', () => {
	test('checks again after each fix', async () => {
		const answers: Record<string, Mistake[]> = {
			'This are teh': [
				{ offset: 0, length: 4, message: '', fix: 'These' },
				{ offset: 5, length: 3, message: '', fix: 'is' },
			],
			'These are teh': [{ offset: 10, length: 3, message: '', fix: 'the' }],
		};

		expect(await fixStepByStep('This are teh', async (text) => answers[text] ?? [])).toBe(
			'These are the',
		);
	});
});
