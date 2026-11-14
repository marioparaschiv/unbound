import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';
import { View } from 'react-native';
import { useState } from 'react';

import { getEdits, saveEdits } from '~/lib/store';
import { redrawMessage } from '~/lib/redraw';
import { withEdit } from '~/lib/edits';

type Target = { channelId: string; messageId: string; original: string };

type EditSheetProps = Target & { onClose: () => void };

function EditSheet({ channelId, messageId, original, onClose }: EditSheetProps) {
	const saved = getEdits()[messageId];
	const [text, setText] = useState(saved ?? original);

	function save(next: string) {
		saveEdits(withEdit(getEdits(), messageId, next, original));
		redrawMessage(channelId, messageId);
		toasts.success(next === original ? 'RESTORED' : 'SAVED');
		onClose();
	}

	return (
		<Discord.ActionSheet>
			<View style={{ gap: 12, padding: 16 }}>
				<Discord.Text variant='heading-lg/semibold'>
					{messages.EDIT_LOCALLY_TITLE}
				</Discord.Text>
				<Discord.TextInput
					description={messages.EDIT_LOCALLY_HELP}
					autoCorrect={false}
					multiline
					value={text}
					onChange={setText}
				/>
				<Discord.Button
					text={messages.SAVE}
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
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the sheet that edits a message's text on this device only.
 * @param target The message, its channel, and what it says on Discord.
 */
export function openEditSheet(target: Target): void {
	openSheet(`unbound-edit-locally-${target.messageId}`, EditSheet, target);
}

export default EditSheet;
