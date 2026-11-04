import { Discord } from '@unbound-app/api/metro/components';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { toasts, ui } from '@unbound-app/api';
import { useState } from 'react';

import {
	addUserId,
	editUserId,
	isUserId,
	parseUserList,
	removeUserId,
} from '~/reply-mention/user-list';
import UserIdEditor from '~/components/user-id-editor';

// `original` is the ID being edited, or `null` while adding a new one.
type Editor = { original: string | null };

function SettingsPanel() {
	const userList = useSetting('userList');
	const pingListed = useSetting('shouldPingListed');
	const [editor, setEditor] = useState<Editor | null>(null);
	const userIds = parseUserList(userList);

	function save(value: string) {
		const userId = value.trim();

		if (!isUserId(userId)) {
			toasts.show({
				title: messages.PLUGIN_NAME,
				content: messages.INVALID_USER_ID,
			});

			return;
		}

		settings.userList = editor?.original
			? editUserId(userList, editor.original, userId)
			: addUserId(userList, userId);
		setEditor(null);
	}

	function renderEditor(original: string | null) {
		return (
			<UserIdEditor
				key={`editor-${original ?? ''}`}
				initialValue={original ?? ''}
				onCancel={() => setEditor(null)}
				onSave={save}
			/>
		);
	}

	return (
		<ui.Page>
			<ui.Section title={messages.EXCEPTIONS}>
				<ui.Row
					label={messages.ADD_USER_ID}
					subLabel={messages.ADD_USER_ID_SUBTITLE}
					arrow
					onPress={() => setEditor({ original: null })}
				/>
				{editor?.original === null ? renderEditor(null) : null}
				{userIds.length ? (
					userIds.map((userId) =>
						editor?.original === userId ? (
							renderEditor(userId)
						) : (
							<ui.Row
								key={userId}
								label={userId}
								subLabel={messages.TAP_TO_EDIT}
								onPress={() => setEditor({ original: userId })}
								trailing={
									<Discord.Stack direction='horizontal' spacing={8}>
										<Discord.Button
											size='sm'
											variant='secondary'
											text={messages.EDIT}
											onPress={() => setEditor({ original: userId })}
										/>
										<Discord.Button
											size='sm'
											variant='destructive'
											text={messages.DELETE}
											onPress={() => {
												settings.userList = removeUserId(userList, userId);
											}}
										/>
									</Discord.Stack>
								}
							/>
						),
					)
				) : (
					<ui.Row label={messages.NO_USERS} />
				)}
				<ui.SwitchRow
					label={messages.ONLY_PING_LISTED}
					subLabel={
						pingListed ? messages.ONLY_PING_LISTED_ON : messages.ONLY_PING_LISTED_OFF
					}
					value={pingListed}
					onValueChange={(value) => {
						settings.shouldPingListed = value;
					}}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
