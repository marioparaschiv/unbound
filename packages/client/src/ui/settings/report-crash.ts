import {
	markCrashReported,
	type CrashIssueLink,
	type CrashRecord,
} from '~/diagnostics/crash-history';
import { readDebugInfo, readEntitlements } from '~/diagnostics/read-debug-info';
import { crashIssueDraft, findCrashIssue } from '~/diagnostics/crash-issue';
import { issueURL } from '~/diagnostics/issue-report';
import { confirm } from '~/dialogs/api';
import { Linking } from '~/metro/api';

/**
 * @description Takes a tapped crash to GitHub: its known issue, an open issue that already mentions it once the user
 * agrees, or else, again once they agree, a bug report with the crash and this install's details filled in.
 * @param record The crash.
 * @param pluginName The name of the plugin the crash blamed, if any.
 * @param onLinked Receives the issue a crash turned out to have, so the row can show it.
 */
export async function reportCrashOnGitHub(
	record: CrashRecord,
	pluginName: string | undefined,
	onLinked: (issue: CrashIssueLink) => void,
): Promise<void> {
	if (record.issue) {
		await Linking.openURL(record.issue.url);

		return;
	}

	const found = await findCrashIssue(record).catch(() => undefined);

	if (found) {
		const open = await confirm('UNBOUND_CRASH_ISSUE_FOUND_TITLE', {
			body: 'UNBOUND_CRASH_ISSUE_FOUND_BODY',
			bodyVars: { number: found.number },
			confirm: 'UNBOUND_CRASH_ISSUE_OPEN',
		});

		if (!open) return;

		await markCrashReported(record.at, { issue: found });
		onLinked(found);
		await Linking.openURL(found.url);

		return;
	}

	const report = await confirm('UNBOUND_CRASH_REPORT_TITLE', {
		body: 'UNBOUND_CRASH_REPORT_BODY',
		confirm: 'UNBOUND_CRASH_REPORT_CONFIRM',
	});

	if (report) {
		await Linking.openURL(
			issueURL(readDebugInfo(), readEntitlements(), crashIssueDraft(record, pluginName)),
		);
	}
}

export default reportCrashOnGitHub;
