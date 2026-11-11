import { describe, expect, test } from 'bun:test';

import { isRecord } from '~/values/is-record';

describe('isRecord', () => {
	test('accepts plain objects and rejects null, arrays and primitives', () => {
		expect(isRecord({ a: 1 })).toBe(true);
		expect(isRecord(null)).toBe(false);
		expect(isRecord([])).toBe(false);
		expect(isRecord('text')).toBe(false);
	});
});
