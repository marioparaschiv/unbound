import { describe, expect, test } from 'bun:test';

import { bandcampPage, formatAmount, readPrice } from '~/lib/price';

const page = 'https://artist.bandcamp.com/track/key';

function html(data: object) {
	return `<html><script type="application/ld+json">${JSON.stringify(data)}</script></html>`;
}

describe('bandcamp prices', () => {
	test('reads album and track links', () => {
		expect(bandcampPage('https://artist.bandcamp.com/album/alpha?from=x')).toBe(
			'https://artist.bandcamp.com/album/alpha',
		);
		expect(bandcampPage('https://bandcamp.com/discover')).toBeUndefined();
	});

	test('reads the offer of the page itself, not merch', () => {
		const data = {
			inAlbum: {
				albumRelease: [
					{ '@id': 'https://artist.bandcamp.com/album/alpha' },
					{
						'@id': page,
						offers: {
							price: 0.99,
							priceCurrency: 'USD',
							priceSpecification: { minPrice: 0.99 },
						},
					},
					{ '@id': `${page}#p1`, offers: { price: 14, priceCurrency: 'USD' } },
				],
			},
		};

		expect(readPrice(html(data), page)).toEqual({
			amount: 0.99,
			currency: 'USD',
			minimum: 0.99,
		});
	});

	test('reads name-your-price releases and skips broken data', () => {
		const data = {
			albumRelease: [
				{
					'@id': page,
					offers: { price: 0, priceCurrency: 'EUR', priceSpecification: { minPrice: 0 } },
				},
			],
		};

		expect(
			readPrice(`<script type="application/ld+json">{</script>${html(data)}`, page),
		).toEqual({
			amount: 0,
			currency: 'EUR',
			minimum: 0,
		});
		expect(readPrice('<html></html>', page)).toBeUndefined();
	});

	test('formats amounts', () => {
		expect(formatAmount(6, 'USD')).toBe('$6.00');
		expect(formatAmount(6, 'CHF')).toBe('CHF 6.00');
	});
});
