import { CURRENCIES } from '~/lib/prices';

const EURO_REGIONS = [
	'AT',
	'BE',
	'CY',
	'DE',
	'EE',
	'ES',
	'FI',
	'FR',
	'GR',
	'HR',
	'IE',
	'IT',
	'LT',
	'LU',
	'LV',
	'MT',
	'NL',
	'PT',
	'SI',
	'SK',
];

const REGION_CURRENCIES: Record<string, string> = {
	...Object.fromEntries(EURO_REGIONS.map((region) => [region, 'EUR'])),
	AU: 'AUD',
	BR: 'BRL',
	CA: 'CAD',
	CH: 'CHF',
	LI: 'CHF',
	CN: 'CNY',
	CZ: 'CZK',
	DK: 'DKK',
	GB: 'GBP',
	HK: 'HKD',
	HU: 'HUF',
	ID: 'IDR',
	IL: 'ILS',
	IN: 'INR',
	IS: 'ISK',
	JP: 'JPY',
	KR: 'KRW',
	MX: 'MXN',
	MY: 'MYR',
	NO: 'NOK',
	NZ: 'NZD',
	PH: 'PHP',
	PL: 'PLN',
	RO: 'RON',
	SE: 'SEK',
	SG: 'SGD',
	TH: 'THB',
	TR: 'TRY',
	US: 'USD',
	ZA: 'ZAR',
};

/**
 * @description Picks the currency a reader in this locale uses, from its region.
 * @param locale A BCP 47 locale such as `de-DE`.
 * @returns The currency code; US dollars when the region is unknown.
 */
export function currencyForLocale(locale: string | undefined): string {
	const region = locale
		?.split(/[-_]/)
		.find(
			(part) => /^[A-Z]{2}$/i.test(part) && part.length === 2 && part === part.toUpperCase(),
		);

	return (region && REGION_CURRENCIES[region]) || 'USD';
}

/**
 * @description Resolves the setting to the currency conversions go into, reading the device's locale for `auto`.
 * @param setting The `currency` setting.
 * @returns A supported currency code.
 */
export function targetCurrency(setting: string): string {
	if (setting !== 'auto' && CURRENCIES.includes(setting)) return setting;

	return currencyForLocale(Intl.DateTimeFormat().resolvedOptions().locale);
}

export default { currencyForLocale, targetCurrency };
