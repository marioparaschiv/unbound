import { Keyboard, TextInput, View, type GestureResponderEvent } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { storage, ui } from '@unbound-app/api';
import { useState } from 'react';

import CommandList from '~/components/command-list';
import CommandForm from '~/components/command-form';
import { getTags } from '~/lib/saved-commands';
import type { Tag } from '~/lib/tags';

// The multiline response field can cover Save and Cancel, so a tap anywhere else closes the keyboard.
function dismissKeyboardOutsideInput({ target }: GestureResponderEvent) {
	const focused = TextInput.State.currentlyFocusedInput();

	if (!focused || target === focused) return;

	if (Number(target) === TextInput.State.currentlyFocusedField()) return;

	Keyboard.dismiss();
}

function SettingsPanel() {
	storage.useBucket(addon.id);

	const tags = getTags();
	const [editing, setEditing] = useState<Tag | 'new' | null>(null);

	return (
		<ui.Page>
			<View style={{ gap: 24 }} onTouchStart={dismissKeyboardOutsideInput}>
				<Discord.Text variant='text-md/normal' color='text-muted'>
					{messages.SETTINGS_INTRO}
				</Discord.Text>
				{editing ? (
					<CommandForm
						original={editing === 'new' ? null : editing}
						tags={tags}
						onClose={() => setEditing(null)}
					/>
				) : (
					<CommandList
						tags={tags}
						onCreate={() => setEditing('new')}
						onEdit={setEditing}
					/>
				)}
			</View>
		</ui.Page>
	);
}

export default SettingsPanel;
