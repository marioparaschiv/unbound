import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';
import { toasts } from '@unbound-app/api';
import { useState } from 'react';

import { addUserId, editUserId, isUserId, parseUserList, removeUserId } from '~/user-list';
import UserIdEditor from '~/components/user-id-editor';
import { settings } from '~/modules';

// `original` is the ID being edited, or `null` while adding a new one.
type Editor = { original: string | null };

function SettingsPanel() {
	const store = settings.useSettingsStore();
	const [editor, setEditor] = useState<Editor | null>(null);
	const userList = store.get('userList', '');
	const pingListed = store.get('shouldPingListed', false);
	const userIds = parseUserList(userList);

	function save(value: string) {
		const userId = value.trim();

		if (!isUserId(userId)) {
			toasts.showToast({
				title: 'No Reply Mention',
				content: 'Enter a numeric Discord user ID.',
			});

			return;
		}

		store.set(
			'userList',
			editor?.original
				? editUserId(userList, editor.original, userId)
				: addUserId(userList, userId),
		);
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
		<Page>
			<Discord.TableRowGroup title='Exceptions'>
				<Discord.TableRow
					label='Add user ID'
					subLabel='Replies can mention these users when the exception is enabled'
					arrow
					onPress={() => setEditor({ original: null })}
				/>
				{editor?.original === null ? renderEditor(null) : null}
				{userIds.length ? (
					userIds.map((userId) =>
						editor?.original === userId ? (
							renderEditor(userId)
						) : (
							<Discord.TableRow
								key={userId}
								label={userId}
								subLabel='Tap to edit'
								onPress={() => setEditor({ original: userId })}
								trailing={
									<Discord.Stack direction='horizontal' spacing={8}>
										<Discord.Button
											size='sm'
											variant='secondary'
											text='Edit'
											onPress={() => setEditor({ original: userId })}
										/>
										<Discord.Button
											size='sm'
											variant='destructive'
											text='Delete'
											onPress={() =>
												store.set(
													'userList',
													removeUserId(userList, userId),
												)
											}
										/>
									</Discord.Stack>
								}
							/>
						),
					)
				) : (
					<Discord.TableRow label='No users added yet.' />
				)}
				<Discord.TableSwitchRow
					label='Only Ping Listed Users'
					subLabel={
						pingListed
							? 'Replies mention only the users listed above'
							: 'Replies do not mention anyone by default'
					}
					value={pingListed}
					onValueChange={(value) => store.set('shouldPingListed', value)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default SettingsPanel;
