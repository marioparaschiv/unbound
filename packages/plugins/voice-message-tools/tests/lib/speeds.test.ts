import { describe, expect, test } from 'bun:test';

import { nextSpeed, speedLabel, storedSpeedFor } from '~/lib/speeds';

describe('speed row', () => {
	test('steps through the speeds and wraps around', () => {
		expect(nextSpeed('1.0')).toBe('1.5');
		expect(nextSpeed('2.0')).toBe('0.75');
		expect(nextSpeed('0.75')).toBe('1.0');
		expect(nextSpeed('3')).toBe('1.0');
	});

	test('steps on from a speed saved before whole speeds kept their .0', () => {
		expect(nextSpeed('1')).toBe('1.5');
		expect(nextSpeed('2')).toBe('0.75');
	});

	test('reads an old whole speed as its stored form', () => {
		expect(storedSpeedFor('1')).toBe('1.0');
		expect(storedSpeedFor('2')).toBe('2.0');
		expect(storedSpeedFor('1.5')).toBe('1.5');
		expect(storedSpeedFor('3')).toBeUndefined();
		expect(storedSpeedFor(2)).toBeUndefined();
	});

	test('labels a speed', () => {
		expect(speedLabel(1.5)).toBe('1.5×');
		expect(speedLabel(1)).toBe('1×');
	});
});
