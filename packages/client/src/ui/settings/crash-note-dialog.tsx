import { View } from 'react-native';
import { useState } from 'react';

import { addCrashNote } from '~/diagnostics/crash-reports';
import type { DialogContentProps } from '~/dialogs/api';
import { Discord } from '~/metro/components';
import { error, info } from '~/toasts/api';
import { messages } from '~/i18n/api';

import useStyles from './crash-note-dialog.style';

type CrashNoteDialogProps = DialogContentProps & { reportId: string; issue: number };

/**
 * @description The body of a filed crash's dialog: a field for what the user was doing, posted as a comment on the
 * crash's GitHub issue.
 */
function CrashNoteDialog({ dismiss, reportId, issue }: CrashNoteDialogProps) {
	const styles = useStyles();
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);

	async function send() {
		setBusy(true);

		const sent = await addCrashNote(reportId, note);

		setBusy(false);

		if (sent) {
			info('UNBOUND_CRASH_NOTE_SENT', { number: issue });
			dismiss();
		} else {
			error('UNBOUND_CRASH_NOTE_FAILED', new Error(`No note for report ${reportId}`));
		}
	}

	return (
		<View style={styles.content}>
			<Discord.TextInput
				value={note}
				placeholder={messages.UNBOUND_CRASH_NOTE_PLACEHOLDER}
				multiline
				onChange={setNote}
			/>
			<Discord.Button
				text={messages.UNBOUND_CRASH_NOTE_SEND}
				variant='primary'
				loading={busy}
				disabled={!note.trim()}
				onPress={() => void send()}
			/>
		</View>
	);
}

export default CrashNoteDialog;
