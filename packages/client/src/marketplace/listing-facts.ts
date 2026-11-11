import type { SourcePin } from '@unbound-app/contracts/source';

const KB = 1024;
const MB = KB * KB;

/**
 * @description Formats a bundle's size in kilobytes or megabytes, as the website's About card does.
 * @param bytes The size in bytes.
 * @returns The size, such as `12.3 KB`.
 */
export function formatBytes(bytes: number): string {
	if (bytes >= MB) {
		return `${Number((bytes / MB).toFixed(1))} MB`;
	}

	return `${Number((bytes / KB).toFixed(1))} KB`;
}

/**
 * @description Links a version's addon directory at its pinned commit on GitHub.
 * @param pin The version's source pin.
 * @returns The directory's GitHub URL.
 */
export function sourceUrl(pin: SourcePin): string {
	const path = pin.path ? `/${pin.path}` : '';

	return `https://github.com/${pin.repository}/tree/${pin.commitSha}${path}`;
}
