import { REPOSITORY } from '~/core/repository';

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

/** What a bug report starts with besides the environment: its title and the log section. */
export type IssueDraft = { title?: string; logs?: string };

/**
 * @description Builds a link that opens the repository's bug report form with the platform and the device's details filled in.
 * @param info The versions and device details `/debug` reports.
 * @param entitlements The app's entitlements as a plist, or an empty string.
 * @param draft A title and logs to start the report with.
 * @returns The `issues/new` URL.
 */
export function issueURL(info: DebugInfo, entitlements = '', draft: IssueDraft = {}): string {
	const query = new URLSearchParams({
		template: BUG_REPORT_FORM,
		title: draft.title ?? 'bug: ',
		platform: info.platform,
		environment: issueEnvironment(info, entitlements),
		...(draft.logs ? { logs: draft.logs } : {}),
	});

	return `https://github.com/${REPOSITORY}/issues/new?${query.toString()}`;
}
