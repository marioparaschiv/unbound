import { describe, expect, test } from 'bun:test';

import { createChannelToggle } from '../../src/composer/channel-toggle';

const DEFAULTS = { persist: false, autoDisable: true };

describe('createChannelToggle', () => {
	test('starts off', () => {
		expect(createChannelToggle().isActive('a', false)).toBe(false);
	});

	test('toggles on and off in a channel', () => {
		const toggle = createChannelToggle();

		expect(toggle.toggle('a', false)).toBe(true);
		expect(toggle.isActive('a', false)).toBe(true);
		expect(toggle.toggle('a', false)).toBe(false);
		expect(toggle.isActive('a', false)).toBe(false);
	});

	test('applies only to the channel it was turned on in without persistence', () => {
		const toggle = createChannelToggle();

		toggle.toggle('a', false);

		expect(toggle.isActive('b', false)).toBe(false);
		expect(toggle.toggle('b', false)).toBe(true);
		expect(toggle.isActive('a', false)).toBe(false);
	});

	test('applies everywhere with persistence', () => {
		const toggle = createChannelToggle();

		toggle.toggle('a', true);

		expect(toggle.isActive('b', true)).toBe(true);
	});

	test('auto disables after one send', () => {
		const toggle = createChannelToggle();

		toggle.toggle('a', false);

		expect(toggle.takeForSend('a', DEFAULTS)).toBe(true);
		expect(toggle.takeForSend('a', DEFAULTS)).toBe(false);
	});

	test('stays on without auto disable', () => {
		const toggle = createChannelToggle();

		toggle.toggle('a', false);

		expect(toggle.takeForSend('a', { ...DEFAULTS, autoDisable: false })).toBe(true);
		expect(toggle.takeForSend('a', { ...DEFAULTS, autoDisable: false })).toBe(true);
	});

	test('does not mark sends in other channels', () => {
		const toggle = createChannelToggle();

		toggle.toggle('a', false);

		expect(toggle.takeForSend('b', DEFAULTS)).toBe(false);
		expect(toggle.isActive('a', false)).toBe(true);
	});

	test('marks sends in any channel with persistence', () => {
		const toggle = createChannelToggle();

		toggle.toggle('a', true);

		expect(toggle.takeForSend('b', { persist: true, autoDisable: true })).toBe(true);
		expect(toggle.isActive('a', true)).toBe(false);
	});

	test('turns off on a channel switch without persistence', () => {
		const toggle = createChannelToggle();

		toggle.toggle('a', false);
		toggle.switchChannel('b', false);
		toggle.switchChannel('a', false);

		expect(toggle.isActive('a', false)).toBe(false);
	});

	test('stays on across channel switches with persistence', () => {
		const toggle = createChannelToggle();

		toggle.toggle('a', true);
		toggle.switchChannel('b', true);

		expect(toggle.isActive('b', true)).toBe(true);
	});

	test('ignores a switch to the same channel', () => {
		const toggle = createChannelToggle();

		toggle.toggle('a', false);
		toggle.switchChannel('a', false);

		expect(toggle.isActive('a', false)).toBe(true);
	});

	test('notifies listeners only on changes', () => {
		const toggle = createChannelToggle();
		let calls = 0;
		const unsubscribe = toggle.subscribe(() => calls++);

		toggle.toggle('a', false);
		toggle.switchChannel('a', false);
		toggle.switchChannel('b', false);
		toggle.switchChannel('b', false);
		unsubscribe();
		toggle.toggle('a', false);

		expect(calls).toBe(2);
	});
});

describe('a toggle that starts on', () => {
	test('is on in every channel until turned off, and switching channels keeps it', () => {
		const toggle = createChannelToggle(true);

		expect(toggle.isActive('a', false)).toBe(true);
		toggle.switchChannel('b', false);
		expect(toggle.isActive('b', false)).toBe(true);
		expect(toggle.toggle('b', false)).toBe(false);
		expect(toggle.isActive('a', false)).toBe(false);
	});
});
