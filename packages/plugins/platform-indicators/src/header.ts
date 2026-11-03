import { describePlatforms, platformGlyph, type PlatformStatus } from '~/platforms';

export type MessageRow = {
	timestamp?: string;
	timestampAccessibilityLabel?: string;
	username?: string;
	tagText?: string | null;
	opTagText?: string | null;
	roleIcon?: object | null;
};

const AVATAR_COLUMN = 55;
const POINTS_PER_CHARACTER = 8;
const GLYPH_LENGTH = 2;

/**
 * @description Builds the platform symbols a message header shows, such as `🖥️📱`.
 * @param statuses The author's platforms.
 * @returns The symbols, or an empty string for no platforms.
 */
export function platformSuffix(statuses: PlatformStatus[]): string {
	return statuses.map(({ platform }) => platformGlyph(platform)).join('');
}

function fitsHeader(row: MessageRow, timestamp: string, width: number, extra: number): boolean {
	const length =
		(row.username ?? '').length +
		(row.tagText ?? row.opTagText ?? '').length +
		timestamp.length +
		extra +
		4 +
		(row.roleIcon ? 3 : 0);

	return length <= Math.floor((width - AVATAR_COLUMN) / POINTS_PER_CHARACTER);
}

/**
 * @description Adds the author's platforms to a message header: as symbols after the timestamp when the header has room, and in words to its accessibility label.
 * @param row The message row Discord generated, changed in place.
 * @param statuses The author's platforms.
 * @param width The window width in points.
 */
export function addPlatforms(row: MessageRow, statuses: PlatformStatus[], width: number): void {
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

	if (!fitsHeader(row, timestamp, width, statuses.length * GLYPH_LENGTH + 3)) return;

	row.timestamp = `${timestamp} • ${suffix}`;
}
