import { Keyboard, TextInput, View, type GestureResponderEvent } from 'react-native';
import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';
import { useState } from 'react';

import CommandList from '~/components/command-list';
import CommandForm from '~/components/command-form';
import { getTags } from '~/saved-commands';
import type { Tag } from '~/tags';
import { settings } from '~/modules';

// The multiline response field can cover Save and Cancel, so a tap anywhere else closes the keyboard.
function dismissKeyboardOutsideInput({ target }: GestureResponderEvent) {
	const focused = TextInput.State.currentlyFocusedInput();

	if (!focused || target === focused) return;

	if (Number(target) === TextInput.State.currentlyFocusedField()) return;

	Keyboard.dismiss();
}

function SettingsPanel() {
	settings.useSettingsStore();

	const tags = getTags();
	const [editing, setEditing] = useState<Tag | 'new' | null>(null);

	return (
		<Page>
			<View style={{ gap: 24 }} onTouchStart={dismissKeyboardOutsideInput}>
				<Discord.Text variant='text-md/normal' color='text-muted'>
					Create slash commands that send saved text, images, and videos.
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
		</Page>
	);
}

export default SettingsPanel;
