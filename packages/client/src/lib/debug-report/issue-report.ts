import { REPOSITORY } from '~/lib/repository';

import { debugLines, type DebugInfo } from './format-debug-info';

const DESCRIPTION_TEMPLATE = [
	'### Issue Description',
	"<!-- Describe the issue you're experiencing -->",
	'',
	'**Steps to reproduce:**',
	'1. ',
	'2. ',
	'3. ',
	'',
	'**Expected behavior:**',
	'',
	'**Actual behavior:**',
	'',
].join('\n');

/**
 * @description Builds the body of a GitHub issue the way the loader toolbox does: the environment, the iOS entitlements when there are any, and a template to describe the problem.
 * @param info The versions and device details `/debug` reports.
 * @param entitlements The app's entitlements as a plist, or an empty string.
 * @returns The issue body as Markdown.
 */
export function issueBody(info: DebugInfo, entitlements = ''): string {
	return [
		'### Environment',
		...debugLines(info),
		'',
		...(entitlements ? ['### Entitlements', '```xml', entitlements.trim(), '```', ''] : []),
		DESCRIPTION_TEMPLATE,
	].join('\n');
}

/**
 * @description Builds a link that opens a new GitHub issue prefilled with the device's details.
 * @param info The versions and device details `/debug` reports.
 * @param entitlements The app's entitlements as a plist, or an empty string.
 * @returns The `issues/new` URL.
 */
export function issueURL(info: DebugInfo, entitlements = ''): string {
	const title = `bug(${info.platform}): replace this with a descriptive title`;

	return `https://github.com/${REPOSITORY}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(issueBody(info, entitlements))}`;
}

export default { issueBody, issueURL };
