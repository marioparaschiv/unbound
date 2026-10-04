import { expect, test } from 'bun:test';

import toastDuration from './toast-duration';

test('uses configured milliseconds when a toast has no duration override', () => {
	expect(toastDuration(undefined, 5000)).toBe(5000);
});

test('preserves explicit duration overrides including persistent toasts', () => {
	expect(toastDuration(3000, 5000)).toBe(3000);
	expect(toastDuration(0, 5000)).toBe(0);
});
