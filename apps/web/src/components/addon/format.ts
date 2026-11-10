import type { SourcePin } from '@unbound-app/contracts/source';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
const BYTES_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const COUNT_FORMAT = new Intl.NumberFormat('en-US');
const COMPACT_FORMAT = new Intl.NumberFormat('en-US', {
	notation: 'compact',
	maximumFractionDigits: 1,
});

/**
 * @description Formats an install count, in full or abbreviated for a card.
 * @param count The install count.
 * @param short Whether to abbreviate thousands and millions.
 * @returns The count, such as `1,234` or `1.2K`.
 */
export function formatInstalls(count: number, short: boolean = false): string {
	return (short ? COMPACT_FORMAT : COUNT_FORMAT).format(count);
}

/**
 * @description Formats an ISO timestamp as a UTC calendar date.
 * @param iso The timestamp.
 * @returns The date, such as `May 4, 2026`.
 */
export function formatDate(iso: string): string {
	return DATE_FORMAT.format(new Date(iso));
}

/**
 * @description Formats a byte count in kilobytes or megabytes.
 * @param bytes The size in bytes.
 * @returns The size, such as `212.3 KB`.
 */
export function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) {
		return `${BYTES_FORMAT.format(bytes / 1024 / 1024)} MB`;
	}

	return `${BYTES_FORMAT.format(bytes / 1024)} KB`;
}

/**
 * @description Shortens a commit SHA the way GitHub shows it.
 * @param sha The full commit SHA.
 * @returns Its first seven characters.
 */
export function shortSha(sha: string): string {
	return sha.slice(0, 7);
}

/**
 * @description Links the pinned commit on GitHub.
 * @param pin The version's source pin.
 * @returns The commit's GitHub URL.
 */
export function commitUrl(pin: SourcePin): string {
	return `https://github.com/${pin.repository}/commit/${pin.commitSha}`;
}

/**
 * @description Links the addon directory at the pinned commit on GitHub.
 * @param pin The version's source pin.
 * @returns The directory's GitHub URL.
 */
export function directoryUrl(pin: SourcePin): string {
	const path = pin.path ? `/${pin.path}` : '';

	return `https://github.com/${pin.repository}/tree/${pin.commitSha}${path}`;
}

export default { formatInstalls, formatDate, formatBytes, shortSha, commitUrl, directoryUrl };
