import { REPOSITORY } from '~/lib/repository';

import { debugLines, type DebugInfo } from './format-debug-info';

const BUG_REPORT_FORM = 'bug-report.yml';

/**
 * @description Builds the environment section of a bug report the way the loader toolbox does: the versions and device, and the iOS entitlements when there are any.
 * @param info The versions and device details `/debug` reports.
 * @param entitlements The app's entitlements as a plist, or an empty string.
 * @returns The environment as Markdown.
 */
export function issueEnvironment(info: DebugInfo, entitlements = ''): string {
	return [
		...debugLines(info),
		...(entitlements ? ['', '### Entitlements', '```xml', entitlements.trim(), '```'] : []),
	].join('\n');
}

/**
 * @description Builds a link that opens the repository's bug report form with the platform and the device's details filled in.
 * @param info The versions and device details `/debug` reports.
 * @param entitlements The app's entitlements as a plist, or an empty string.
 * @returns The `issues/new` URL.
 */
export function issueURL(info: DebugInfo, entitlements = ''): string {
	const query = new URLSearchParams({
		template: BUG_REPORT_FORM,
		title: 'bug: ',
		platform: info.platform,
		environment: issueEnvironment(info, entitlements),
	});

	return `https://github.com/${REPOSITORY}/issues/new?${query.toString()}`;
}

export default { issueEnvironment, issueURL };
