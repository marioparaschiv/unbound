import { describe, expect, test } from 'bun:test';

import { createSilentToggle, withSilentFlag } from '~/silent/toggle';

const DEFAULTS = { persist: false, autoDisable: true };

describe('withSilentFlag', () => {
	test('sets SUPPRESS_NOTIFICATIONS on a message with no flags', () => {
		expect(withSilentFlag(undefined)).toBe(4096);
		expect(withSilentFlag(0)).toBe(4096);
	});

	test('keeps the other flags', () => {
		expect(withSilentFlag(8192)).toBe(8192 | 4096);
		expect(withSilentFlag(4)).toBe(4 | 4096);
	});

	test('is unchanged when the flag is already set', () => {
		expect(withSilentFlag(4096)).toBe(4096);
		expect(withSilentFlag(4096 | 8192)).toBe(4096 | 8192);
	});

	test('ignores flags that are not integers', () => {
		expect(withSilentFlag('4')).toBe(4096);
		expect(withSilentFlag(1.5)).toBe(4096);
		expect(withSilentFlag(null)).toBe(4096);
	});
});

describe('createSilentToggle', () => {
	test('starts off', () => {
		expect(createSilentToggle().isActive('a', false)).toBe(false);
	});

	test('toggles on and off in a channel', () => {
		const toggle = createSilentToggle();

		expect(toggle.toggle('a', false)).toBe(true);
		expect(toggle.isActive('a', false)).toBe(true);
		expect(toggle.toggle('a', false)).toBe(false);
		expect(toggle.isActive('a', false)).toBe(false);
	});

	test('applies only to the channel it was turned on in without persistence', () => {
		const toggle = createSilentToggle();

		toggle.toggle('a', false);

		expect(toggle.isActive('b', false)).toBe(false);
		expect(toggle.toggle('b', false)).toBe(true);
		expect(toggle.isActive('a', false)).toBe(false);
	});

	test('applies everywhere with persistence', () => {
		const toggle = createSilentToggle();

		toggle.toggle('a', true);

		expect(toggle.isActive('b', true)).toBe(true);
	});

	test('auto disables after one send', () => {
		const toggle = createSilentToggle();

		toggle.toggle('a', false);

		expect(toggle.takeForSend('a', DEFAULTS)).toBe(true);
		expect(toggle.takeForSend('a', DEFAULTS)).toBe(false);
	});

	test('stays on without auto disable', () => {
		const toggle = createSilentToggle();

		toggle.toggle('a', false);

		expect(toggle.takeForSend('a', { ...DEFAULTS, autoDisable: false })).toBe(true);
		expect(toggle.takeForSend('a', { ...DEFAULTS, autoDisable: false })).toBe(true);
	});

	test('does not mark sends in other channels', () => {
		const toggle = createSilentToggle();

		toggle.toggle('a', false);

		expect(toggle.takeForSend('b', DEFAULTS)).toBe(false);
		expect(toggle.isActive('a', false)).toBe(true);
	});

	test('marks sends in any channel with persistence', () => {
		const toggle = createSilentToggle();

		toggle.toggle('a', true);

		expect(toggle.takeForSend('b', { persist: true, autoDisable: true })).toBe(true);
		expect(toggle.isActive('a', true)).toBe(false);
	});

	test('turns off on a channel switch without persistence', () => {
		const toggle = createSilentToggle();

		toggle.toggle('a', false);
		toggle.switchChannel('b', false);
		toggle.switchChannel('a', false);

		expect(toggle.isActive('a', false)).toBe(false);
	});

	test('stays on across channel switches with persistence', () => {
		const toggle = createSilentToggle();

		toggle.toggle('a', true);
		toggle.switchChannel('b', true);

		expect(toggle.isActive('b', true)).toBe(true);
	});

	test('ignores a switch to the same channel', () => {
		const toggle = createSilentToggle();

		toggle.toggle('a', false);
		toggle.switchChannel('a', false);

		expect(toggle.isActive('a', false)).toBe(true);
	});

	test('notifies listeners only on changes', () => {
		const toggle = createSilentToggle();
		let calls = 0;
		const unsubscribe = toggle.subscribe(() => calls++);

		toggle.toggle('a', false);
		toggle.switchChannel('a', false);
		toggle.reset();
		toggle.reset();
		unsubscribe();
		toggle.toggle('a', false);

		expect(calls).toBe(2);
	});
});
