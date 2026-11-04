import { expect, test } from 'bun:test';

import { keyboardRotationOffset } from '~/rotation/ios/keyboard-layout';

test('keeps the rotated input at its pre-keyboard position', () => {
	expect(
		keyboardRotationOffset(
			{ rootHeight: 667, inputTop: 601, inputHeight: 32 },
			{ rootHeight: 667, inputTop: 407, inputHeight: 32 },
		),
	).toBe(-194);
});

test('returns no translation when either layout is unavailable', () => {
	expect(
		keyboardRotationOffset(undefined, { rootHeight: 667, inputTop: 407, inputHeight: 32 }),
	).toBe(undefined);
});
