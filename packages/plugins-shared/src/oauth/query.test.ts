import { describe, expect, test } from 'bun:test';

import { readQuery } from './query';

describe('readQuery', () => {
	test('decodes keys and values, reading plus signs as spaces', () => {
		expect(readQuery('https://x.test/cb?code=a%2Fb&error_description=Access+denied')).toEqual({
			code: 'a/b',
			error_description: 'Access denied',
		});
	});

	test('ignores the fragment and keeps the first value of a repeated key', () => {
		expect(readQuery('https://x.test/cb?state=1&state=2#code=3')).toEqual({ state: '1' });
	});

	test('returns no parameters for a URL without a query', () => {
		expect(readQuery('https://x.test/cb')).toEqual({});
	});
});
