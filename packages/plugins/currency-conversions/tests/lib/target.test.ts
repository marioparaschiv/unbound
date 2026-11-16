import { describe, expect, test } from 'bun:test';

import { currencyForLocale } from '~/lib/target';

describe("the reader's currency", () => {
	test('comes from the locale region', () => {
		expect(currencyForLocale('de-DE')).toBe('EUR');
		expect(currencyForLocale('en-GB')).toBe('GBP');
		expect(currencyForLocale('en_AU')).toBe('AUD');
		expect(currencyForLocale('zh-Hans-CN')).toBe('CNY');
		expect(currencyForLocale('en')).toBe('USD');
	});
});
