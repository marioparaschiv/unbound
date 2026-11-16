export type Price = { start: number; end: number; text: string; amount: number; currency: string };

export const CURRENCIES = [
	'AUD',
	'BRL',
	'CAD',
	'CHF',
	'CNY',
	'CZK',
	'DKK',
	'EUR',
	'GBP',
	'HKD',
	'HUF',
	'IDR',
	'ILS',
	'INR',
	'ISK',
	'JPY',
	'KRW',
	'MXN',
	'MYR',
	'NOK',
	'NZD',
	'PHP',
	'PLN',
	'RON',
	'SEK',
	'SGD',
	'THB',
	'TRY',
	'USD',
	'ZAR',
];

const SYMBOLS: Record<string, string> = {
	us$: 'USD',
	a$: 'AUD',
	au$: 'AUD',
	c$: 'CAD',
	ca$: 'CAD',
	nz$: 'NZD',
	hk$: 'HKD',
	s$: 'SGD',
	r$: 'BRL',
	$: 'USD',
	'€': 'EUR',
	'£': 'GBP',
	'¥': 'JPY',
	'₹': 'INR',
	'₩': 'KRW',
	'₺': 'TRY',
	'₱': 'PHP',
	'₪': 'ILS',
	zł: 'PLN',
	kč: 'CZK',
	ft: 'HUF',
};

const CODES = CURRENCIES.join('|');
const PREFIX_SYMBOLS = '(?:us\\$|au?\\$|ca?\\$|nz\\$|hk\\$|s\\$|r\\$|\\$|€|£|¥|₹|₩|₺|₱|₪)';
const SUFFIX_SYMBOLS = '(?:€|zł|kč|ft)';
const NUMBER = '(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
const PRICE = new RegExp(
	[
		`(^|[^\\w$])(${PREFIX_SYMBOLS}|(?:${CODES})\\s?)${NUMBER}([km])?(?![\\w$€£¥])`,
		`(^|[^\\w$])${NUMBER}\\s?(${SUFFIX_SYMBOLS}|(?:${CODES}))(?![\\w])`,
	].join('|'),
	'giu',
);

const MULTIPLIERS: Record<string, number> = { k: 1_000, m: 1_000_000 };

/**
 * @description Reads an amount written with either decimal style: `1,299.99`, `1.299,99`, `12,50` or `1,000`.
 * @param text The amount.
 * @returns Its value.
 */
export function parseAmount(text: string): number {
	const lastComma = text.lastIndexOf(',');
	const lastDot = text.lastIndexOf('.');

	if (lastComma >= 0 && lastDot >= 0) {
		const decimal = lastComma > lastDot ? ',' : '.';
		const thousands = decimal === ',' ? '.' : ',';

		return Number(text.split(thousands).join('').replace(decimal, '.'));
	}

	const separator = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : undefined;

	if (!separator) return Number(text);

	const groups = text.split(separator);
	const isThousands = groups.length > 2 || groups.at(-1)!.length === 3;

	return Number(isThousands ? groups.join('') : groups.join('.'));
}

function currencyOf(label: string): string | undefined {
	const key = label.trim().toLowerCase();

	return SYMBOLS[key] ?? (CURRENCIES.includes(key.toUpperCase()) ? key.toUpperCase() : undefined);
}

/**
 * @description Finds prices in text: an amount with a currency symbol or code before or after it, such as `$25`,
 * `12,99 €`, `CHF 35`, `40 usd` or `$2.5k`.
 * @param text The text.
 * @returns The prices in order, with where each starts and ends.
 */
export function findPrices(text: string): Price[] {
	const prices: Price[] = [];

	for (const match of text.matchAll(PRICE)) {
		const [
			,
			prefixLead,
			prefixLabel,
			prefixNumber,
			multiplier,
			suffixLead,
			suffixNumber,
			suffixLabel,
		] = match;
		const lead = prefixLead ?? suffixLead ?? '';
		const label = prefixLabel ?? suffixLabel ?? '';
		const number = prefixNumber ?? suffixNumber ?? '';
		const currency = currencyOf(label);

		if (!currency) continue;

		const start = match.index + lead.length;
		const matched = match[0].slice(lead.length);

		prices.push({
			start,
			end: start + matched.length,
			text: matched,
			amount: parseAmount(number) * (MULTIPLIERS[multiplier?.toLowerCase() ?? ''] ?? 1),
			currency,
		});
	}

	return prices;
}

export default { findPrices, parseAmount, CURRENCIES };
