import { expect, test } from 'bun:test';

import { keyboardRotationOffset } from '~/lib/android/keyboard-layout';

test('translates the rotated composer back to its pre-keyboard screen position', () => {
	expect(keyboardRotationOffset(96, 942)).toBe(-846);
});

test('does not return a translation for missing or invalid screen positions', () => {
	expect(keyboardRotationOffset(undefined, 942)).toBe(undefined);
	expect(keyboardRotationOffset(96, Number.NaN)).toBe(undefined);
});
