import { createElement } from 'react';

import { recordCrash, type CrashIssueLink, type CrashRecord } from '~/diagnostics/crash-history';
import type { CrashReportAddon } from '~/diagnostics/crash-report';
import { fileRecordedCrash } from '~/diagnostics/crash-reports';
import type { CaughtError } from '~/ui/error-fallback';
import { confirm, showDialog } from '~/dialogs/api';
import { format, messages } from '~/i18n/api';
import { error, info } from '~/toasts/api';
import { Linking } from '~/metro/api';

import CrashNoteDialog from './crash-note-dialog';

function openIssueDialog(issue: CrashIssueLink, reportId: string | undefined) {
	const openIssue = {
		label: messages.UNBOUND_CRASH_OPEN_ISSUE,
		onPress: () => void Linking.openURL(issue.url),
	};

	if (!reportId) {
		void Linking.openURL(issue.url);

		return;
	}

	showDialog({
		title: format('UNBOUND_CRASH_NOTE_TITLE', { number: issue.number }),
		content: (props) =>
			createElement(CrashNoteDialog, { ...props, reportId, issue: issue.number }),
		buttons: [openIssue],
		cancel: true,
	});
}

/**
 * @description Takes a tapped crash to GitHub: offers to add a note to its known issue or open it, or once the user agrees, has Unbound's server file
 * it, joining the issue that already tracks it, and opens that issue.
 * @param record The crash.
 * @param plugin The installed plugin the crash blamed and its name, if any.
 * @param onLinked Receives the issue the crash was filed under, so the row can show it.
 * @param stack The crash's stack, when the caller still has it.
 */
export async function reportCrashOnGitHub(
	record: CrashRecord,
	plugin: { name: string; addon: CrashReportAddon } | undefined,
	onLinked: (issue: CrashIssueLink) => void,
	stack?: string,
): Promise<void> {
	if (record.issue) {
		openIssueDialog(record.issue, record.reportId);

		return;
	}

	const report = await confirm('UNBOUND_CRASH_REPORT_TITLE', {
		body: 'UNBOUND_CRASH_REPORT_BODY',
		confirm: 'UNBOUND_CRASH_REPORT_CONFIRM',
	});

	if (!report) {
		return;
	}

	const filed = await fileRecordedCrash(record, plugin?.addon, stack);

	if (filed?.issue) {
		onLinked(filed.issue);
		await Linking.openURL(filed.issue.url);
	} else if (filed?.unfiled === 'third-party') {
		info('UNBOUND_CRASH_REPORT_THIRD_PARTY', { name: plugin?.name ?? record.addon ?? '' });
	} else if (filed) {
		info(
			filed.unfiled === 'unavailable'
				? 'UNBOUND_CRASH_ISSUE_UNAVAILABLE'
				: 'UNBOUND_CRASH_ISSUE_RETRY',
		);
	} else {
		error('UNBOUND_CRASH_ISSUE_FAILED', new Error(`Failed to send crash ${record.at}`));
	}
}

/**
 * @description Files the error the crash screen shows: records it in Recent Crashes, then takes it to GitHub the same way
 * a tapped row does, with the error's stack and component stack.
 * @param caught The caught error and its component stack.
 */
export async function reportCaughtError({ error, componentStack }: CaughtError): Promise<void> {
	const record: CrashRecord = {
		at: Date.now(),
		kind: 'crash',
		message: error.message.split('\n')[0] || error.name,
	};
	const stack = [error.stack, componentStack].filter(Boolean).join('\n');

	await recordCrash(record);
	await reportCrashOnGitHub(record, undefined, () => undefined, stack || undefined);
}

export default reportCrashOnGitHub;
