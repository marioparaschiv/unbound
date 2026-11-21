import { describe, expect, test } from 'bun:test';

import { isValidThumbHash } from '~/core/thumbhash';

describe('isValidThumbHash', () => {
	test('accepts the hashes Discord sends', () => {
		expect(isValidThumbHash('DAiCA4Ardm1vuYt9QP0b0goZiIdwiRg=')).toBe(true);
		expect(isValidThumbHash('JFyCDQI1eYeKh6P9lyJBMAB2B4mYaIOLZw==')).toBe(true);
		expect(isValidThumbHash('ygcGDIR3h4iHiIhwiHV5f4CnCA==')).toBe(true);
	});

	test('rejects short, truncated and non-base64 hashes', () => {
		expect(isValidThumbHash('PwAAAAAA')).toBe(false);
		expect(isValidThumbHash('DAiCA4Ardm1vuYt9')).toBe(false);
		expect(isValidThumbHash('AAAA')).toBe(false);
		expect(isValidThumbHash('not a hash!')).toBe(false);
		expect(isValidThumbHash('')).toBe(false);
	});
});
