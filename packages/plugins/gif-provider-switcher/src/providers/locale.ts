/**
 * @description Turns a Discord locale into the locale Tenor expects, such as `en_us` for `en-US`.
 * @param locale A Discord locale, such as `en-US` or `pt-BR`.
 * @returns The Tenor locale.
 */
export function toTenorLocale(locale: string): string {
	return locale.replace('-', '_').toLowerCase();
}

/**
 * @description Turns a Discord locale into the language Giphy expects: a two-letter code, or `zh-CN` and `zh-TW` for Chinese.
 * @param locale A Discord locale, such as `en-US` or `zh-TW`.
 * @returns The Giphy language code.
 */
export function toGiphyLanguage(locale: string): string {
	const lower = locale.toLowerCase();

	if (lower.startsWith('zh')) {
		return lower.includes('tw') || lower.includes('hant') ? 'zh-TW' : 'zh-CN';
	}

	return lower.split(/[-_]/)[0] ?? lower;
}
