type LocaleListener = (locale: string) => void;

let currentLocale: string | null = null;

const listeners = new Set<LocaleListener>();

/**
 * @description Reads the Discord locale Unbound and every plugin translate into.
 * @returns The locale code, or `null` before i18n starts.
 */
export function getLocale(): string | null {
	return currentLocale;
}

/**
 * @description Sets the active locale, then tells every listener when it changed.
 * @param locale The Discord locale code.
 */
export function setLocale(locale: string): void {
	if (locale === currentLocale) return;

	currentLocale = locale;

	for (const listener of listeners) listener(locale);
}

/**
 * @description Calls a listener each time the active locale changes.
 * @param listener Receives the new locale code.
 * @returns A function that removes the listener.
 */
export function onLocaleChange(listener: LocaleListener): () => void {
	listeners.add(listener);

	return () => void listeners.delete(listener);
}

/**
 * @description Counts the listeners following locale changes, so a leak shows in diagnostics and tests.
 * @returns How many listeners are registered.
 */
export function countLocaleListeners(): number {
	return listeners.size;
}
