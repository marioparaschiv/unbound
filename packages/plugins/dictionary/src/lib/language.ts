/**
 * @description Reads the phone's language code, which Wiktionary's results prefer.
 * @returns A code such as `en` or `de`.
 */
export function readerLanguage(): string {
	return Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0] || 'en';
}

export default { readerLanguage };
