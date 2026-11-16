import { describe, expect, test } from 'bun:test';

import { convertText } from '~/lib/convert';

const rates = { base: 'EUR', rates: { EUR: 1, USD: 1.1, GBP: 0.85, JPY: 176 } };

describe('converting prices in text', () => {
	test('adds the target currency after each price', () => {
		expect(convertText('$11 or £8.50', 'EUR', rates, 'en-US')).toBe(
			'$11 (≈ €10.00) or £8.50 (≈ €10.00)',
		);
	});

	test('leaves prices already in the target currency and unknown currencies alone', () => {
		expect(convertText('€5 and 3 XYZ', 'EUR', rates, 'en-US')).toBe('€5 and 3 XYZ');
	});

	test("writes yen without decimals and follows the reader's locale", () => {
		expect(convertText('$10', 'JPY', rates, 'en-US')).toBe('$10 (≈ ¥1,600)');
		expect(convertText('$11', 'EUR', rates, 'de-DE')).toBe('$11 (≈ 10,00\u00a0€)');
	});

	test('keeps code blocks and links as they are', () => {
		expect(convertText('`$11` https://x.test/$11', 'EUR', rates, 'en-US')).toBe(
			'`$11` https://x.test/$11',
		);
	});
});
