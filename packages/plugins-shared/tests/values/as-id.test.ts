import { describe, expect, test } from 'bun:test';

import { asId } from '~/values/as-id';

describe('asId', () => {
	test('accepts only non-empty strings', () => {
		expect(asId('1')).toBe('1');
		expect(asId('')).toBeUndefined();
		expect(asId(1)).toBeUndefined();
	});
});
