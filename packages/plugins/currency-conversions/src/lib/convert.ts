import { findPrices } from '~/lib/prices';

export type Rates = { base: string; rates: Record<string, number> };

const PROTECTED = /(```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|<[^>\n]+>)/g;

function rateOf({ base, rates }: Rates, currency: string): number | undefined {
	return currency === base ? 1 : rates[currency];
}

/**
 * @description Converts an amount between currencies through the rates' base currency.
 * @param amount The amount.
 * @param from Its currency.
 * @param to The currency to convert to.
 * @param rates The rates.
 * @returns The converted amount, or `undefined` when a rate is missing.
 */
export function convertAmount(
	amount: number,
	from: string,
	to: string,
	rates: Rates,
): number | undefined {
	const fromRate = rateOf(rates, from);
	const toRate = rateOf(rates, to);

	return fromRate && toRate ? (amount / fromRate) * toRate : undefined;
}

function convertPart(part: string, target: string, rates: Rates, locale: string | undefined) {
	const money = new Intl.NumberFormat(locale, { style: 'currency', currency: target });
	let result = '';
	let last = 0;

	for (const price of findPrices(part)) {
		const converted =
			price.currency === target
				? undefined
				: convertAmount(price.amount, price.currency, target, rates);

		if (converted === undefined) continue;

		result += `${part.slice(last, price.end)} (≈ ${money.format(converted)})`;
		last = price.end;
	}

	return result + part.slice(last);
}

/**
 * @description Adds an approximate conversion in brackets after each price in a message, leaving code, links and
 * mentions alone.
 * @param text The message text.
 * @param target The currency to convert to.
 * @param rates The exchange rates.
 * @param locale How to write the converted amounts; the device's when omitted.
 * @returns The text with conversions, or the same text when it has no prices to convert.
 */
export function convertText(text: string, target: string, rates: Rates, locale?: string): string {
	return text
		.split(PROTECTED)
		.map((part, index) => (index % 2 ? part : convertPart(part, target, rates, locale)))
		.join('');
}

export default { convertText, convertAmount };
