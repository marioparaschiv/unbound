export type Price = { amount: number; currency: string; minimum: number };

type Offer = { price?: number; priceCurrency?: string; priceSpecification?: { minPrice?: number } };
type Release = { '@id'?: string; offers?: Offer };
type LinkedData = { albumRelease?: Release[]; inAlbum?: { albumRelease?: Release[] } };

const BANDCAMP = /^https:\/\/[\w-]+\.bandcamp\.com\/(?:album|track)\/[\w-]+/;
const LINKED_DATA = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const SYMBOLS: Record<string, string> = {
	USD: '$',
	EUR: '€',
	GBP: '£',
	JPY: '¥',
	CAD: 'CA$',
	AUD: 'A$',
};

/**
 * @description Reads a Bandcamp album or track link, dropping its query and fragment.
 * @param url Any link.
 * @returns The page's address, or `undefined` for other links.
 */
export function bandcampPage(url: string | undefined): string | undefined {
	return url ? BANDCAMP.exec(url)?.[0] : undefined;
}

function releasesOf(data: LinkedData): Release[] {
	return [...(data.albumRelease ?? []), ...(data.inAlbum?.albumRelease ?? [])];
}

/**
 * @description Reads the digital price of a Bandcamp page from its linked data: the offer of the release that is the page
 * itself, not merch or the album a track is on.
 * @param html The page.
 * @param page The page's address.
 * @returns The price, or `undefined` when the page lists none.
 */
export function readPrice(html: string, page: string): Price | undefined {
	for (const [, json] of html.matchAll(LINKED_DATA)) {
		let data: LinkedData;

		try {
			data = JSON.parse(json!) as LinkedData;
		} catch {
			continue;
		}

		const offer = releasesOf(data).find((release) => release['@id'] === page)?.offers;

		if (typeof offer?.price === 'number' && offer.priceCurrency) {
			return {
				amount: offer.price,
				currency: offer.priceCurrency,
				minimum: offer.priceSpecification?.minPrice ?? offer.price,
			};
		}
	}

	return undefined;
}

/**
 * @description Formats an amount with its currency's symbol, or its code when it has no common symbol.
 * @param amount The amount.
 * @param currency The ISO currency code.
 * @returns The amount, such as `$6.00` or `CHF 6.00`.
 */
export function formatAmount(amount: number, currency: string): string {
	const symbol = SYMBOLS[currency];

	return symbol ? `${symbol}${amount.toFixed(2)}` : `${currency} ${amount.toFixed(2)}`;
}

export default { bandcampPage, readPrice, formatAmount };
