import { describePlatforms, listLocale, platformLabel, type PlatformStatus } from '~/lib/platforms';

export type MessageRow = {
	timestamp?: string;
	timestampAccessibilityLabel?: string;
	username?: string;
};

/**
 * @description Names the platforms a message header shows, such as `Desktop, Mobile`. Words, not emoji: the
 * timestamp is native text in Discord's muted colour, and the phone and globe emoji have no monochrome form.
 * @param statuses The author's platforms.
 * @param locale The user's locale; the list joins in it only when the plugin ships messages for it.
 * @returns The platform names, or an empty string for no platforms.
 */
export function platformSuffix(statuses: PlatformStatus[], locale: string): string {
	if (!statuses.length) return '';

	return new Intl.ListFormat(listLocale(locale), { style: 'short', type: 'unit' }).format(
		statuses.map(({ platform }) => platformLabel(platform)),
	);
}

/**
 * @description Adds the author's platforms to a message header: as names after the timestamp, which Discord makes room for by shortening the name, and in words to its accessibility label.
 * @param row The message row Discord generated, changed in place.
 * @param statuses The author's platforms.
 * @param locale The locale code that joins the platform names into a list.
 */
export function addPlatforms(row: MessageRow, statuses: PlatformStatus[], locale: string): void {
	const suffix = platformSuffix(statuses, locale);
	const timestamp = row.timestamp;

	if (!suffix || typeof timestamp !== 'string') return;

	const description = describePlatforms(statuses, locale);

	if (
		typeof row.timestampAccessibilityLabel === 'string' &&
		!row.timestampAccessibilityLabel.endsWith(` • ${description}`)
	) {
		row.timestampAccessibilityLabel += ` • ${description}`;
	}

	if (timestamp.endsWith(` • ${suffix}`)) return;

	row.timestamp = `${timestamp} • ${suffix}`;
}
