import { describe, expect, test } from 'bun:test';

import { findPrices, parseAmount } from '~/lib/prices';

const found = (text: string) =>
	findPrices(text).map(({ amount, currency, text: match }) => ({ amount, currency, match }));

describe('finding prices', () => {
	test('reads symbols before and after the amount', () => {
		expect(found('it was $25 and £3.50')).toEqual([
			{ amount: 25, currency: 'USD', match: '$25' },
			{ amount: 3.5, currency: 'GBP', match: '£3.50' },
		]);
		expect(found('costs 12,99 € here')).toEqual([
			{ amount: 12.99, currency: 'EUR', match: '12,99 €' },
		]);
		expect(found('¥1500')).toEqual([{ amount: 1500, currency: 'JPY', match: '¥1500' }]);
	});

	test('reads codes and prefixed dollars', () => {
		expect(found('pay 40 usd or CHF 35')).toEqual([
			{ amount: 40, currency: 'USD', match: '40 usd' },
			{ amount: 35, currency: 'CHF', match: 'CHF 35' },
		]);
		expect(found('A$20, C$15 and R$100')).toEqual([
			{ amount: 20, currency: 'AUD', match: 'A$20' },
			{ amount: 15, currency: 'CAD', match: 'C$15' },
			{ amount: 100, currency: 'BRL', match: 'R$100' },
		]);
	});

	test('reads thousands and shorthand', () => {
		expect(found('$1,299.99')).toEqual([
			{ amount: 1299.99, currency: 'USD', match: '$1,299.99' },
		]);
		expect(found('€1.299,99')).toEqual([
			{ amount: 1299.99, currency: 'EUR', match: '€1.299,99' },
		]);
		expect(found('$2.5k')).toEqual([{ amount: 2500, currency: 'USD', match: '$2.5k' }]);
	});

	test('skips what is not a price', () => {
		expect(found('USB 3 and 5 eur0s and the $ sign and US$')).toEqual([]);
	});
});

describe('parsing amounts', () => {
	test('reads both decimal styles', () => {
		expect(parseAmount('1,299.99')).toBe(1299.99);
		expect(parseAmount('1.299,99')).toBe(1299.99);
		expect(parseAmount('12,50')).toBe(12.5);
		expect(parseAmount('1,000')).toBe(1000);
		expect(parseAmount('1.000.000')).toBe(1000000);
	});
});
