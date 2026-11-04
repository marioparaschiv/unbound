import { describe, expect, test } from 'bun:test';

import { createToggles } from '~/toggles';

describe('createToggles', () => {
	test('follows the default until switched', () => {
		let byDefault = true;
		const toggles = createToggles(() => byDefault);

		expect(toggles.isDearrowed('1')).toBe(true);

		byDefault = false;

		expect(toggles.isDearrowed('1')).toBe(false);
	});

	test('remembers a switch per message', () => {
		const toggles = createToggles(() => true);

		expect(toggles.toggle('1')).toBe(false);
		expect(toggles.isDearrowed('1')).toBe(false);
		expect(toggles.isDearrowed('2')).toBe(true);
		expect(toggles.toggle('1')).toBe(true);
	});

	test('forgets switches on clear', () => {
		const toggles = createToggles(() => true);

		toggles.toggle('1');
		toggles.clear();

		expect(toggles.isDearrowed('1')).toBe(true);
	});

	test('uses the default for a message without an id', () => {
		expect(createToggles(() => false).isDearrowed(undefined)).toBe(false);
	});
});
