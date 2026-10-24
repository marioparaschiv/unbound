import { LANGUAGES } from '~/constants';

export type Language = {
	code: string;
	name: string;
	nativeName?: string;
};

/**
 * @description Formats a language for the picker, adding its native name when it differs.
 * @param language The language to label.
 * @returns A label such as `German (Deutsch)`.
 */
export function languageLabel({ name, nativeName }: Language): string {
	return nativeName && nativeName !== name ? `${name} (${nativeName})` : name;
}

/**
 * @description Lists the languages whose code, name, or native name contains the query.
 * @param query The user's search text; blank matches every language.
 * @param includeAuto Whether to lead with the "Auto detect" choice, which ignores the query.
 * @returns The picker's rows in display order.
 */
export function searchLanguages(query: string, includeAuto: boolean = false): Language[] {
	const needle = query.trim().toLowerCase();
	const matches = LANGUAGES.filter(
		({ code, name, nativeName }) =>
			code.toLowerCase().includes(needle) ||
			name.toLowerCase().includes(needle) ||
			nativeName?.toLowerCase().includes(needle),
	);

	return includeAuto ? [{ code: 'auto', name: 'Auto detect' }, ...matches] : matches;
}
