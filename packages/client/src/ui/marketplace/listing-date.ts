import { Moment } from '~/metro/common';

/**
 * @description Formats a publish date in the active locale, like "Oct 19, 2025".
 * @param date An ISO timestamp.
 * @returns The date.
 */
export function formatListingDate(date: string): string {
	return Moment.utc(date).local().format('ll');
}
