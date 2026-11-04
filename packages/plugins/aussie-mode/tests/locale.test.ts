import { expect, mock, test } from 'bun:test';

mock.module('~/locale/platform', () => ({ deviceLocale: () => 'en_AU' }));

const { isAussieDevice, isAussieLocale } = await import('~/locale');

test('accepts Australian English in either separator form and with extensions', () => {
	for (const locale of ['en-AU', 'en_AU', 'en-AU-u-ca-gregory']) {
		expect(isAussieLocale(locale)).toBe(true);
	}
	for (const locale of ['en-US', 'en-AUS', 'de-AT', '']) {
		expect(isAussieLocale(locale)).toBe(false);
	}
});

test('reads the platform locale first', () => {
	expect(isAussieDevice()).toBe(true);
});
