import { describe, expect, test } from 'bun:test';

import {
	covers,
	fits,
	mapThrough,
	normalizeEdit,
	overlapsStretch,
	placement,
	restretchedRange,
	stretches,
	type TextRewriteEdit,
} from '@unbound-plugins/shared/native/android/text-edits';

function edit(overrides: Partial<TextRewriteEdit> = {}) {
	return normalizeEdit({
		start: 4,
		end: 8,
		text: '@someone',
		stretchFrom: 4,
		stretchTo: 8,
		stretchClasses: ['x'],
		...overrides,
	});
}

describe('text edits', () => {
	test('maps positions through edits a later rule made', () => {
		const insertion = edit({ start: 10, end: 10, text: '+embed+' });
		const replacement = edit({ start: 2, end: 6, text: 'X' });

		expect(mapThrough(1, [insertion, replacement])).toBe(1);
		expect(mapThrough(10, [insertion])).toBe(17);
		expect(mapThrough(16, [insertion, replacement])).toBe(20);
		expect(mapThrough(4, [replacement])).toBe(2);
	});

	test('applies edits only inside the text', () => {
		expect(fits(edit(), 8)).toBe(true);
		expect(fits(edit(), 7)).toBe(false);
		expect(fits(edit({ start: 9, end: 8 }), 20)).toBe(false);
	});

	test('stretches only a window with span classes', () => {
		expect(stretches(edit())).toBe(true);
		expect(stretches(edit({ stretchClasses: [] }))).toBe(false);
		expect(stretches(edit({ stretchFrom: 8, stretchTo: 8 }))).toBe(false);
	});

	test('finds spans that overlap or cover the window', () => {
		const window = edit();

		expect(overlapsStretch(0, 5, window)).toBe(true);
		expect(overlapsStretch(7, 12, window)).toBe(true);
		expect(overlapsStretch(0, 4, window)).toBe(false);
		expect(overlapsStretch(8, 12, window)).toBe(false);
		expect(covers(4, 8, window)).toBe(true);
		expect(covers(4, 7, window)).toBe(false);
	});

	test('grows stretched spans with the replacement', () => {
		const window = edit({ text: '@someone' });

		expect(restretchedRange(true, 4, 8, window)).toEqual([4, 12]);
		expect(restretchedRange(false, 2, 6, window)).toEqual([2, 6]);
		expect(restretchedRange(false, -1, 6, window)).toBeUndefined();
		expect(restretchedRange(true, 0, 0, edit({ text: '' }))).toBeUndefined();
	});

	test('places hosts on their placeholder line', () => {
		const origin = { x: 10, y: 20 };
		const padding = { x: 2, y: 3 };
		const bottom = { placeholder: 5, width: 40, height: 16, pinTop: false, offsetY: 1 };

		expect(placement(bottom, origin, 30, 50, 84, padding)).toEqual({ x: 42, y: 92 });
		expect(
			placement({ ...bottom, pinTop: true, offsetY: -2 }, origin, 30, 50, 84, padding),
		).toEqual({ x: 42, y: 71 });
	});

	test('turns off every optional feature by default', () => {
		const plain = normalizeEdit({ start: 0, end: 1, text: 'a' });

		expect(plain.spacerOffset).toBe(-1);
		expect(plain.clearFrom).toBe(-1);
		expect(plain.stretchClasses).toEqual([]);
		expect(plain.imageKey).toBeUndefined();
	});
});
