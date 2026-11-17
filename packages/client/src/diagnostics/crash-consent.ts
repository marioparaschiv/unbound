import { setSetting } from '~/settings/unbound';
import { format, messages } from '~/i18n/api';
import { showDialog } from '~/dialogs/api';

/** What the user answered when asked to send a crash report. */
export type CrashConsent = 'once' | 'always' | 'declined';

let askedThisLaunch = false;

/**
 * @description Asks whether to send a crash report while reporting is off, at most once per launch so a burst of
 * failures shows one dialog. Always turns reporting on.
 * @param subject The addon that crashed, when the crash belongs to one.
 * @returns The answer; a second crash in the same launch counts as declined.
 */
export function askToReportCrash(subject?: string): Promise<CrashConsent> {
	if (askedThisLaunch) {
		return Promise.resolve('declined');
	}

	askedThisLaunch = true;

	return new Promise((resolve) => {
		showDialog({
			title: messages.UNBOUND_CRASH_REPORT_ASK_TITLE,
			body: subject
				? format('UNBOUND_CRASH_REPORT_ASK_ADDON', { name: subject })
				: messages.UNBOUND_CRASH_REPORT_ASK_BODY,
			buttons: [
				{ label: messages.UNBOUND_CRASH_REPORT_SEND, onPress: () => resolve('once') },
				{
					label: messages.UNBOUND_CRASH_REPORT_ALWAYS,
					variant: 'secondary',
					onPress: () => {
						setSetting('crash-reports', true);
						resolve('always');
					},
				},
			],
			cancel: messages.UNBOUND_CRASH_REPORT_NOT_NOW,
			onCancel: () => resolve('declined'),
			onDismiss: () => resolve('declined'),
		});
	});
}
