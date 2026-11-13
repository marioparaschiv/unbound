import { describe, expect, test } from 'bun:test';

import { isUsrbgData, usrbgBanner } from '~/lib/usrbg';

const data = {
	endpoint: 'https://usrbg.is-hardly.online',
	bucket: 'usrbg',
	prefix: 'v2/',
	users: { '123': 'abc' },
};

describe('usrbg', () => {
	test('links a listed user to their banner', () => {
		expect(usrbgBanner(data, '123')).toBe('https://usrbg.is-hardly.online/usrbg/v2/123?abc');
	});

	test('gives nothing for an unlisted user or before the list loads', () => {
		expect(usrbgBanner(data, '456')).toBeUndefined();
		expect(usrbgBanner(undefined, '123')).toBeUndefined();
	});

	test('accepts only the list shape', () => {
		expect(isUsrbgData(data)).toBe(true);
		expect(isUsrbgData({ users: {} })).toBe(false);
	});
});
