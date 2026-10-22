import { useState } from 'react';

import { metro, patcher, storage, toasts } from '@unbound-app/api';

import {
	SettingsCard,
	SettingsRow,
	SettingsScrollView,
	SettingsSection,
	SettingsSwitchRow,
	getSettingsColors,
} from '@shared/settings-ui';
import {
	addUserId,
	editUserId,
	isUserId,
	parseUserList,
	removeUserId,
} from '@no-reply-mention/user-list';

const ADDON_ID = 'unbound.no-reply-mention';
const STORE = storage.getStore(ADDON_ID);

let unpatch: (() => void) | null = null;

interface PendingReply {
	message?: { author?: { id?: string } };
	shouldMention?: boolean;
}

function shouldMention(authorId: string | undefined): boolean {
	if (!authorId) return false;

	const listed = parseUserList().includes(authorId);
	return STORE.get('shouldPingListed', false) && listed;
}

type UserEditor = {
	mode: 'add' | 'edit';
	original?: string;
};

function UserIdEditor({
	initialValue,
	onCancel,
	onSave,
}: {
	initialValue: string;
	onCancel: () => void;
	onSave: (value: string) => void;
}) {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();
	const [value, setValue] = useState(initialValue);

	return (
		<SettingsCard>
			<ReactNative.View style={{ gap: 12 }}>
				<ReactNative.Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
					{initialValue ? 'Edit user ID' : 'Add user ID'}
				</ReactNative.Text>
				<ReactNative.TextInput
					autoCapitalize='none'
					autoCorrect={false}
					keyboardType='number-pad'
					placeholder='Discord user ID'
					placeholderTextColor={colors.muted}
					style={{
						backgroundColor: colors.input,
						borderColor: colors.border,
						borderRadius: 8,
						borderWidth: 1,
						color: colors.text,
						paddingHorizontal: 12,
						paddingVertical: 10,
					}}
					value={value}
					onChangeText={setValue}
				/>
				<ReactNative.View style={{ flexDirection: 'row', gap: 12 }}>
					<ReactNative.Pressable
						onPress={onCancel}
						style={{
							alignItems: 'center',
							borderColor: colors.border,
							borderRadius: 10,
							borderWidth: 1,
							flex: 1,
							minHeight: 48,
							justifyContent: 'center',
							paddingHorizontal: 12,
						}}
					>
						<ReactNative.Text style={{ color: colors.text, fontWeight: '700' }}>
							Cancel
						</ReactNative.Text>
					</ReactNative.Pressable>
					<ReactNative.Pressable
						onPress={() => onSave(value)}
						style={{
							alignItems: 'center',
							backgroundColor: colors.accent,
							borderRadius: 10,
							flex: 1,
							minHeight: 48,
							justifyContent: 'center',
							paddingHorizontal: 12,
						}}
					>
						<ReactNative.Text style={{ color: '#fff', fontWeight: '700' }}>
							Save
						</ReactNative.Text>
					</ReactNative.Pressable>
				</ReactNative.View>
			</ReactNative.View>
		</SettingsCard>
	);
}

function UserIdRow({
	userId,
	onEdit,
	onDelete,
}: {
	userId: string;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();

	return (
		<SettingsCard>
			<ReactNative.View
				style={{ alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 48 }}
			>
				<ReactNative.Pressable onPress={onEdit} style={{ flex: 1, paddingVertical: 4 }}>
					<ReactNative.Text
						style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
					>
						{userId}
					</ReactNative.Text>
					<ReactNative.Text
						style={{ color: colors.muted, fontSize: 14, lineHeight: 19, marginTop: 3 }}
					>
						Tap to edit
					</ReactNative.Text>
				</ReactNative.Pressable>
				<ReactNative.Pressable
					hitSlop={8}
					onPress={onEdit}
					style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }}
				>
					<ReactNative.Text style={{ color: colors.accent, fontWeight: '700' }}>
						Edit
					</ReactNative.Text>
				</ReactNative.Pressable>
				<ReactNative.Pressable
					hitSlop={8}
					onPress={onDelete}
					style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }}
				>
					<ReactNative.Text style={{ color: colors.danger, fontWeight: '700' }}>
						Delete
					</ReactNative.Text>
				</ReactNative.Pressable>
			</ReactNative.View>
		</SettingsCard>
	);
}

function NoReplyMentionSettings() {
	const ReactNative = metro.common.ReactNative;
	const state = STORE.useSettingsStore();
	const [editor, setEditor] = useState<UserEditor | null>(null);
	const pingListed = state.get('shouldPingListed', false);
	const userIds = parseUserList(state.get('userList', ''));
	const colors = getSettingsColors();

	function saveUserId(value: string): void {
		const userId = value.trim();
		if (!isUserId(userId)) {
			toasts.showToast({
				title: 'No Reply Mention',
				content: 'Enter a numeric Discord user ID.',
			});
			return;
		}

		const current = state.get('userList', '');
		state.set(
			'userList',
			editor?.mode === 'edit' && editor.original
				? editUserId(current, editor.original, userId)
				: addUserId(current, userId),
		);
		setEditor(null);
	}

	function deleteUserId(userId: string): void {
		state.set('userList', removeUserId(state.get('userList', ''), userId));
	}

	return (
		<SettingsScrollView>
			<SettingsSection title='Exceptions'>
				<SettingsRow
					label='Add user ID'
					description='Replies can mention these users when the exception is enabled'
					arrow
					onPress={() => setEditor({ mode: 'add' })}
				/>
				{editor?.mode === 'add' ? (
					<UserIdEditor
						initialValue=''
						onCancel={() => setEditor(null)}
						onSave={saveUserId}
					/>
				) : null}
				{userIds.length ? (
					<ReactNative.View style={{ gap: 12 }}>
						{userIds.map((userId) => (
							<ReactNative.View key={userId}>
								{editor?.mode === 'edit' && editor.original === userId ? (
									<UserIdEditor
										initialValue={userId}
										onCancel={() => setEditor(null)}
										onSave={saveUserId}
									/>
								) : (
									<UserIdRow
										userId={userId}
										onDelete={() => deleteUserId(userId)}
										onEdit={() => setEditor({ mode: 'edit', original: userId })}
									/>
								)}
							</ReactNative.View>
						))}
					</ReactNative.View>
				) : (
					<SettingsCard>
						<ReactNative.Text
							style={{ color: colors.muted, fontSize: 14, lineHeight: 19 }}
						>
							No users added yet.
						</ReactNative.Text>
					</SettingsCard>
				)}
				<SettingsSwitchRow
					label='Only Ping Listed Users'
					description={
						pingListed
							? 'Replies mention only the users listed above'
							: 'Replies do not mention anyone by default'
					}
					value={pingListed}
					onValueChange={(value: boolean) => state.set('shouldPingListed', value)}
				/>
			</SettingsSection>
		</SettingsScrollView>
	);
}

export default {
	start() {
		const actions = metro.findByProps('createPendingReply') as any;
		if (typeof actions?.createPendingReply !== 'function') return;

		unpatch = patcher.before(actions, 'createPendingReply', (ctx) => {
			const reply = ctx.args[0] as PendingReply | undefined;
			if (!reply) return;

			reply.shouldMention = shouldMention(reply.message?.author?.id);
		});
	},

	stop() {
		unpatch?.();
		unpatch = null;
	},
	getSettingsPanel: () => <NoReplyMentionSettings />,
};
