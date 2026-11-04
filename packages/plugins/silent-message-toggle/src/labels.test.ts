import { describe, expect, test } from 'bun:test';

import { toggleLabel, toggledMessage } from '~/labels';

describe('labels', () => {
	test('names the action a tap takes', () => {
		expect(toggleLabel(false)).toBe('Enable Silent Message');
		expect(toggleLabel(true)).toBe('Disable Silent Message');
	});

	test('describes the new state', () => {
		expect(toggledMessage(true)).toContain('without notifications');
		expect(toggledMessage(false)).toContain('notify people again');
	});
});
