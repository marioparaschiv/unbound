import { describe, expect, test } from 'bun:test';

import { roleColorAt } from './role-colors';

describe('roleColorAt', () => {
	test('returns no color for invalid stops', () => {
		expect(roleColorAt([], 0.5)).toBeNull();
		expect(roleColorAt(['#12345g'], 0.5)).toBeNull();
	});

	test('preserves a solid role color', () => {
		expect(roleColorAt(['#1abc9c'], 0)).toBe('#1abc9c');
		expect(roleColorAt(['#1abc9c'], 1)).toBe('#1abc9c');
	});

	test('interpolates a two-stop gradient', () => {
		expect(roleColorAt(['#000000', '#ffffff'], 0)).toBe('#000000');
		expect(roleColorAt(['#000000', '#ffffff'], 0.5)).toBe('#808080');
		expect(roleColorAt(['#000000', '#ffffff'], 1)).toBe('#ffffff');
	});

	test('visits every holographic stop', () => {
		expect(roleColorAt(['#ff0000', '#00ff00', '#0000ff'], 0)).toBe('#ff0000');
		expect(roleColorAt(['#ff0000', '#00ff00', '#0000ff'], 0.5)).toBe('#00ff00');
		expect(roleColorAt(['#ff0000', '#00ff00', '#0000ff'], 1)).toBe('#0000ff');
	});
});
