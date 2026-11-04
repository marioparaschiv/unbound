import { formatChangelogIssues, parseChangelog } from '@unbound-app/contracts/changelog';
import type { Changelog } from '@unbound-app/contracts/changelog';

import { ApiError } from '~/lib/api/errors';

/**
 * @description Reads the entry for a version from an addon's CHANGELOG.md.
 * @param path The file's path, named in errors.
 * @param text The file's text, or `undefined` when the addon has none.
 * @param version The version being submitted.
 * @returns The version's entry, or `null` without a CHANGELOG.md; throws when the file is invalid or lacks the version.
 */
export function readChangelog(
	path: string,
	text: string | undefined,
	version: string,
): Changelog | null {
	if (text === undefined) {
		return null;
	}

	const parsed = parseChangelog(text);

	if (parsed.issues.length > 0) {
		throw new ApiError('invalid_changelog', formatChangelogIssues(parsed.issues, path));
	}

	const release = parsed.releases.get(version);

	if (!release) {
		throw new ApiError('invalid_changelog', `${path} has no entry for ${version}.`);
	}

	return release;
}

export default { readChangelog };
