/**
 * @description Writes the day a friendship began, in the reader's language.
 * @param since When it began, as Discord stores it: an ISO string.
 * @param locale The language, the device's own by default.
 * @returns The date, such as `8 Dec 2020`, or `undefined` for a missing or unreadable date.
 */
export function friendsSinceDate(since: string | undefined, locale?: string): string | undefined {
	if (!since) return undefined;

	const date = new Date(since);

	if (Number.isNaN(date.getTime())) return undefined;

	return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default { friendsSinceDate };
