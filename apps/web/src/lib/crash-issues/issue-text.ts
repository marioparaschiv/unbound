import type { CrashReport } from '@unbound-app/contracts/crash-reports';

import { crashFrames, crashHeadline } from './fingerprint';

const STACK_LIMIT = 12_000;
const TITLE_LIMIT = 120;
const PLATFORM_NAMES = { ios: 'iOS', android: 'Android' } as const;

/**
 * @description Writes the issue title for a crash: who crashed, the headline and the top frame.
 * @param report The crash report.
 * @returns The title, at most 120 characters.
 */
export function crashIssueTitle(report: CrashReport): string {
	const owner = report.addon?.id ?? 'Unbound';
	const [top] = crashFrames(report.stack);
	const title = `crash: (${owner}) ${crashHeadline(report)}${top ? ` in ${top}` : ''} on ${PLATFORM_NAMES[report.platform]}`;

	return title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT - 1)}…` : title;
}

function row(name: string, value: string | number | boolean | undefined | null): string[] {
	return value === undefined || value === null || value === '' ? [] : [`| ${name} | ${value} |`];
}

function enabledAddons(addons: string[] | undefined): string[] {
	return addons?.length
		? [
				`<details><summary>Enabled addons (${addons.length})</summary>`,
				'',
				addons.map((addon) => `- \`${addon}\``).join('\n'),
				'',
				'</details>',
				'',
			]
		: [];
}

/**
 * @description Writes the issue body: the environment, enabled addons, the message and stack, and the fingerprint. The
 * log and breadcrumbs stay on the server, since they can hold the reporter's ids and messages.
 * @param report The crash report.
 * @param reportId The stored report's id.
 * @param fingerprint The crash's fingerprint.
 * @returns The Markdown body.
 */
export function crashIssueBody(report: CrashReport, reportId: string, fingerprint: string): string {
	const addon = report.addon
		? `${report.addon.id} ${report.addon.version} (${report.addon.trust})`
		: undefined;

	return [
		'Opened automatically from a crash report sent by a user who turned crash reporting on.',
		'',
		'| | |',
		'| --- | --- |',
		...row('Kind', report.kind),
		...row('Platform', PLATFORM_NAMES[report.platform]),
		...row('Unbound', report.clientVersion),
		...row('Loader', report.loaderVersion),
		...row('Discord', report.discordVersion),
		...row('OS', report.osVersion),
		...row('Device', report.deviceModel),
		...row('Verified build', report.verifiedBuild),
		...row('Addon', addon),
		...row('Phase', report.phase),
		...row('Seconds', report.seconds),
		...row('Discord build', report.context?.discordBuild),
		...row('Installed from', report.context?.installSource),
		...row('Injected', report.context?.injected?.join(', ')),
		'',
		...enabledAddons(report.context?.addons),
		...(report.message ? ['### Message', '', '```text', report.message, '```', ''] : []),
		...(report.stack
			? ['### Stack', '', '```text', report.stack.slice(0, STACK_LIMIT), '```', '']
			: []),
		`Report \`${reportId}\` · fingerprint \`${fingerprint}\``,
	].join('\n');
}

/**
 * @description Writes the comment added when a known crash comes back on versions its issue has not seen.
 * @param report The crash report.
 * @param reportId The stored report's id.
 * @param reports How many reports the issue has now.
 * @returns The Markdown comment.
 */
export function crashIssueComment(report: CrashReport, reportId: string, reports: number): string {
	return `Seen again on Unbound ${report.clientVersion}, loader ${report.loaderVersion}, Discord ${report.discordVersion} (${PLATFORM_NAMES[report.platform]} ${report.osVersion}); ${reports} reports so far. Report \`${reportId}\`.`;
}

export default { crashIssueTitle, crashIssueBody, crashIssueComment };
