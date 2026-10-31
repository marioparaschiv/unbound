import { TARGET_LOCALE } from '~/constants';
import { deviceLocale } from '~/locale/platform';

function intlLocale(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().locale;
	} catch {
		return undefined;
	}
}

/**
 * @description Tells whether a locale identifier is Australian English, in either the `en_AU` or the `en-AU` form.
 * @param locale The locale identifier.
 * @returns Whether it is `en-AU` or a variant of it.
 */
export function isAussieLocale(locale: string): boolean {
	const normalized = locale.replace('_', '-');

	return normalized === TARGET_LOCALE || normalized.startsWith(`${TARGET_LOCALE}-`);
}

/**
 * @description Tells whether the device is set to Australian English. Reads the platform's own locale
 * setting first and falls back to the JavaScript runtime's locale.
 * @returns Whether the device locale is `en-AU`.
 */
export function isAussieDevice(): boolean {
	return isAussieLocale(deviceLocale() ?? intlLocale() ?? '');
}
