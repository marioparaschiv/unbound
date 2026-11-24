import { Discord } from '@unbound-app/api/metro/components';
import type { DialogContentProps } from '@unbound-app/api/dialogs';
import { dialogs } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useState } from 'react';
import { View } from 'react-native';

import useStyles from '~/components/new-collection-dialog.style';

type NewCollectionDialogProps = DialogContentProps & { onCreate: (name: string) => void };

function NewCollectionDialog({ onCreate, dismiss }: NewCollectionDialogProps) {
	const styles = useStyles();
	const [name, setName] = useState('');

	function create() {
		if (!name.trim()) return;

		dismiss();
		onCreate(name);
	}

	return (
		<View style={styles.content}>
			<Discord.TextInput
				value={name}
				placeholder={messages.NEW_COLLECTION_PLACEHOLDER}
				autoFocus
				onChange={setName}
				onSubmitEditing={create}
			/>
			<Discord.Button
				text={messages.CREATE}
				variant='primary'
				disabled={!name.trim()}
				onPress={create}
			/>
		</View>
	);
}

/**
 * @description Opens Discord's dialog that names a new collection.
 * @param onCreate Receives the typed name once the user presses Create.
 */
export function openNewCollectionDialog(onCreate: (name: string) => void): void {
	dialogs.showDialog({
		title: messages.NEW_COLLECTION,
		content: ({ dismiss }) => <NewCollectionDialog onCreate={onCreate} dismiss={dismiss} />,
		cancel: true,
	});
}

export default NewCollectionDialog;
