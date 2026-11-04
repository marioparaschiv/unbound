import { describePlatforms, platformGlyph, type PlatformStatus } from '~/platforms';

export type MessageRow = {
	timestamp?: string;
	timestampAccessibilityLabel?: string;
	username?: string;
};

/**
 * @description Builds the platform symbols a message header shows, such as `🖥️📱`.
 * @param statuses The author's platforms.
 * @returns The symbols, or an empty string for no platforms.
 */
export function platformSuffix(statuses: PlatformStatus[]): string {
	return statuses.map(({ platform }) => platformGlyph(platform)).join('');
}

/**
 * @description Adds the author's platforms to a message header: as symbols after the timestamp, which Discord makes room for by shortening the name, and in words to its accessibility label.
 * @param row The message row Discord generated, changed in place.
 * @param statuses The author's platforms.
 */
export function addPlatforms(row: MessageRow, statuses: PlatformStatus[]): void {
	const suffix = platformSuffix(statuses);
	const timestamp = row.timestamp;

	if (!suffix || typeof timestamp !== 'string') return;

	const description = describePlatforms(statuses);

	if (
		typeof row.timestampAccessibilityLabel === 'string' &&
		!row.timestampAccessibilityLabel.endsWith(` • ${description}`)
	) {
		row.timestampAccessibilityLabel += ` • ${description}`;
	}

	if (timestamp.endsWith(` • ${suffix}`)) return;

	row.timestamp = `${timestamp} • ${suffix}`;
}
