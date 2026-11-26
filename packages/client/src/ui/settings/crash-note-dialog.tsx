import { View } from 'react-native';
import { useState } from 'react';

import type { CrashIssueLink } from '~/diagnostics/crash-history';
import { addCrashNote } from '~/diagnostics/crash-reports';
import type { DialogContentProps } from '~/dialogs/api';
import { Discord } from '~/metro/components';
import { error, info } from '~/toasts/api';
import { messages } from '~/i18n/api';
import { Linking } from '~/metro/api';

import useStyles from './crash-note-dialog.style';

type CrashNoteDialogProps = DialogContentProps & {
	title: string;
	reportId: string;
	issue: CrashIssueLink;
};

/**
 * @description A filed crash's dialog: a field for what the user was doing, posted as a comment on the crash's GitHub
 * issue, then Send, Open Issue and Cancel.
 */
function CrashNoteDialog({ dismiss, title, reportId, issue }: CrashNoteDialogProps) {
	const styles = useStyles();
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);

	async function send() {
		setBusy(true);

		const sent = await addCrashNote(reportId, note);

		setBusy(false);

		if (sent) {
			info('UNBOUND_CRASH_NOTE_SENT', { number: issue.number });
			dismiss();
		} else {
			error('UNBOUND_CRASH_NOTE_FAILED', new Error(`No note for report ${reportId}`));
		}
	}

	function openIssue() {
		dismiss();
		void Linking.openURL(issue.url);
	}

	// Send sits in `actions` beside the other buttons, spaced as Discord spaces its own dialog buttons.
	return (
		<Discord.AlertModal
			title={title}
			extraContent={
				<View style={styles.content}>
					<Discord.TextInput
						value={note}
						placeholder={messages.UNBOUND_CRASH_NOTE_PLACEHOLDER}
						multiline
						onChange={setNote}
					/>
				</View>
			}
			actions={
				<>
					<Discord.AlertActionButton
						text={messages.UNBOUND_CRASH_NOTE_SEND}
						variant='primary'
						loading={busy}
						disabled={!note.trim()}
						onPress={() => void send()}
					/>
					<Discord.AlertActionButton
						text={messages.UNBOUND_CRASH_OPEN_ISSUE}
						variant='secondary'
						onPress={openIssue}
					/>
					<Discord.AlertActionButton
						text={messages.UNBOUND_CANCEL}
						variant='secondary'
						onPress={dismiss}
					/>
				</>
			}
		/>
	);
}

export default CrashNoteDialog;
