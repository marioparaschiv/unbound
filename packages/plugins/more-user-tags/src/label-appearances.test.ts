import { describe, expect, test } from 'bun:test';

import { createLabelAppearances } from './label-appearances';

const green = { colors: ['#248046', '#ABCDEF'], style: 'gradient' as const };
const red = { colors: ['#da373c'], style: 'solid' as const };

describe('createLabelAppearances', () => {
	test('finds a label by its text and primary color, ignoring case and padding', () => {
		const appearances = createLabelAppearances();

		appearances.set('Staff', green);

		expect(appearances.find(' staff ', '#248046')).toEqual({
			primaryColor: '#248046',
			appearance: { colors: ['#248046', '#abcdef'], style: 'gradient' },
		});
	});

	test('finds a label without a known color only when one appearance matches', () => {
		const appearances = createLabelAppearances();

		appearances.set('Staff', green);
		expect(appearances.find('Staff', null)?.primaryColor).toBe('#248046');

		appearances.set('Staff', red);
		expect(appearances.find('Staff', null)).toBeNull();
		expect(appearances.find('Staff', '#da373c')?.appearance).toEqual(red);
	});

	test('forgets a label set without usable colors', () => {
		const appearances = createLabelAppearances();

		appearances.set('Staff', green);
		appearances.set('Staff', { colors: [], style: 'solid' });

		expect(appearances.find('Staff', '#248046')).toBeNull();
		expect(appearances.isEmpty()).toBe(true);
	});

	test('ignores blank labels', () => {
		const appearances = createLabelAppearances();

		appearances.set('  ', green);

		expect(appearances.isEmpty()).toBe(true);
	});
});
