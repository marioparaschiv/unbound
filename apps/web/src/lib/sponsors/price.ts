const PRICE_FORMAT = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	trailingZeroDisplay: 'stripIfInteger',
});

/**
 * @description Formats a sponsorship price in US dollars, dropping the cents of a whole amount: `$5`, `$4.99`.
 * @param cents The price in cents.
 * @returns The formatted price.
 */
export function formatPrice(cents: number): string {
	return PRICE_FORMAT.format(cents / 100);
}

export default { formatPrice };
