/** The country whose flag stands for each language, for languages one country stands for well enough. */
const LANGUAGE_COUNTRIES: Record<string, string> = {
	ar: 'SA',
	az: 'AZ',
	bg: 'BG',
	cs: 'CZ',
	da: 'DK',
	de: 'DE',
	el: 'GR',
	en: 'GB',
	es: 'ES',
	et: 'EE',
	fa: 'IR',
	fi: 'FI',
	fr: 'FR',
	he: 'IL',
	hi: 'IN',
	hu: 'HU',
	id: 'ID',
	it: 'IT',
	ja: 'JP',
	ko: 'KR',
	lt: 'LT',
	lv: 'LV',
	nl: 'NL',
	pl: 'PL',
	pt: 'PT',
	ro: 'RO',
	ru: 'RU',
	sk: 'SK',
	sl: 'SI',
	sv: 'SE',
	tr: 'TR',
	uk: 'UA',
	zh: 'CN',
};

const REGIONAL_INDICATOR_A = 0x1f1e6;

function countryFlag(country: string): string {
	const upper = country.toUpperCase();

	return String.fromCodePoint(
		REGIONAL_INDICATOR_A + upper.charCodeAt(0) - 65,
		REGIONAL_INDICATOR_A + upper.charCodeAt(1) - 65,
	);
}

/**
 * @description Shows a language as a flag emoji where it has one: a code's region if it names one, such as `pt-BR`, otherwise the country that stands for the language.
 * @param code The language code, such as `de`, `pt-BR` or `zh-TW`.
 * @returns The flag, such as `🇩🇪`, or the code itself for a language without one, such as `eo`.
 */
export function languageFlag(code: string): string {
	const [language = '', region] = code.split(/[-_]/);
	const country =
		region && /^[a-z]{2}$/i.test(region) ? region : LANGUAGE_COUNTRIES[language.toLowerCase()];

	return country ? countryFlag(country) : code;
}

export default languageFlag;
