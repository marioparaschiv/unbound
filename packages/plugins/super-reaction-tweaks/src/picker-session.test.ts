import { describe, expect, test } from 'bun:test';

import { createPickerSession } from '~/picker-session';

describe('createPickerSession', () => {
	test('switches the toggle on once when a picker opens with it off', () => {
		const session = createPickerSession(500);

		session.mount(0);

		expect(session.claimAutoEnable(false)).toBe(true);
		expect(session.claimAutoEnable(false)).toBe(false);
	});

	test('leaves a toggle that is already on alone', () => {
		const session = createPickerSession(500);

		session.mount(0);

		expect(session.claimAutoEnable(true)).toBe(false);
	});

	test('keeps the user’s choice when the toggle remounts inside one picker', () => {
		const session = createPickerSession(500);

		session.mount(0);
		session.claimAutoEnable(false);
		session.pressedByUser();
		session.unmount(1000);
		session.mount(1010);

		expect(session.claimAutoEnable(false)).toBe(false);
	});

	test('does not switch on again after a remount even without a press', () => {
		const session = createPickerSession(500);

		session.mount(0);
		session.claimAutoEnable(false);
		session.unmount(100);
		session.mount(100);

		expect(session.claimAutoEnable(false)).toBe(false);
	});

	test('treats overlapping toggles as one picker', () => {
		const session = createPickerSession(500);

		session.mount(0);
		session.pressedByUser();
		session.mount(10);
		session.unmount(20);
		session.unmount(5000);
		session.mount(5100);

		expect(session.claimAutoEnable(false)).toBe(false);
	});

	test('starts over once the picker has been closed for the grace period', () => {
		const session = createPickerSession(500);

		session.mount(0);
		session.claimAutoEnable(false);
		session.pressedByUser();
		session.unmount(1000);
		session.mount(1500);

		expect(session.claimAutoEnable(false)).toBe(true);
	});

	test('forgets everything on reset', () => {
		const session = createPickerSession(500);

		session.mount(0);
		session.pressedByUser();
		session.reset();
		session.mount(0);

		expect(session.claimAutoEnable(false)).toBe(true);
	});
});
