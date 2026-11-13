import { Keyboard, TextInput, View, type GestureResponderEvent } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useState } from 'react';

import CommandForm from '~/components/command-form';
import { getTags } from '~/lib/saved-commands';

type CommandPageProps = {
	/** The command to edit; `undefined` creates a new one. */
	name?: string;
};

// The multiline response field can cover the buttons, so a tap anywhere else closes the keyboard.
function dismissKeyboardOutsideInput({ target }: GestureResponderEvent) {
	const focused = TextInput.State.currentlyFocusedInput();

	if (!focused || target === focused) return;

	if (Number(target) === TextInput.State.currentlyFocusedField()) return;

	Keyboard.dismiss();
}

/**
 * @description The sub-page that edits one saved command, or creates one; it returns to the list once saved or deleted.
 * @param props The command's name, or none for a new command.
 * @returns The page.
 */
function CommandPage({ name }: CommandPageProps) {
	storage.useBucket(addon.id);

	const navigation = Discord.useNavigation();
	const tags = getTags();
	// Read once: saving a rename or deleting changes the list before the page has left the screen.
	const [original] = useState(() =>
		name === undefined ? null : tags.find((tag) => tag.name === name),
	);

	return (
		<ui.Page>
			<View onTouchStart={dismissKeyboardOutsideInput}>
				{original === undefined ? (
					<Discord.Text variant='text-md/normal' color='text-muted'>
						{messages.COMMAND_NOT_FOUND}
					</Discord.Text>
				) : (
					<CommandForm
						original={original}
						tags={tags}
						onClose={() => navigation.goBack()}
					/>
				)}
			</View>
		</ui.Page>
	);
}

export default CommandPage;
