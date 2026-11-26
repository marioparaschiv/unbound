import { View, type TextInputChangeEvent } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import type { DialogContentProps } from '@unbound-app/api/dialogs';
import { dialogs, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useState } from 'react';

import { getEdits, saveEdits } from '~/lib/store';
import { redrawMessage } from '~/lib/redraw';
import { withEdit } from '~/lib/edits';

import useStyles from '~/components/edit-dialog.style';

type Target = { channelId: string; messageId: string; original: string };

/** What Discord's `TextArea` passes `onChange`: on device a plain string, typed as React Native's change event. */
type TextChange = string | TextInputChangeEvent;

function textOf(change: TextChange): string {
	return typeof change === 'string' ? change : change.nativeEvent.text;
}

function EditDialog({ channelId, messageId, original, dismiss }: Target & DialogContentProps) {
	const styles = useStyles();
	const saved = getEdits()[messageId];
	const [text, setText] = useState(saved ?? original);

	function save(next: string) {
		saveEdits(withEdit(getEdits(), messageId, next, original));
		redrawMessage(channelId, messageId);
		toasts.success(next === original ? 'RESTORED' : 'SAVED');
		dismiss();
	}

	return (
		<View style={styles.content}>
			<Discord.TextArea
				value={text}
				autoFocus
				autoCorrect={false}
				onChange={(change: TextChange) => setText(textOf(change))}
			/>
			<Discord.Button
				text={messages.SAVE}
				variant='primary'
				disabled={!text.trim()}
				onPress={() => save(text)}
			/>
			{saved === undefined ? null : (
				<Discord.Button
					text={messages.RESTORE}
					variant='secondary'
					onPress={() => save(original)}
				/>
			)}
		</View>
	);
}

/**
 * @description Opens Discord's dialog that edits a message's text on this device only.
 * @param target The message, its channel, and what it says on Discord.
 */
export function openEditDialog(target: Target): void {
	dialogs.showDialog({
		title: messages.EDIT_LOCALLY_TITLE,
		body: messages.EDIT_LOCALLY_HELP,
		content: ({ dismiss }) => <EditDialog {...target} dismiss={dismiss} />,
		cancel: true,
	});
}

export default EditDialog;
