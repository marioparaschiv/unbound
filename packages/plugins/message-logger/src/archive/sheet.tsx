import { Discord } from '@unbound-app/api/metro/components';
import { ScrollView, TextInput, View } from 'react-native';
import { useEffect, useReducer, useState } from 'react';
import { flux } from '@unbound-app/api';
import { ActionSheets } from '~/history/modules';
import { UserStore } from '~/log/modules';
import { archiveState, currentAccount, findSaved, subscribe } from './runtime';

let openKey: string | undefined;
function ArchiveSheet() {
	const [, refresh] = useReducer((n) => n + 1, 0);
	const [query, setQuery] = useState('');
	const [channel, setChannel] = useState('');
	const [page, setPage] = useState(0);
	const user = flux.useStore(UserStore, (store) => store.getCurrentUser()?.id ?? '');
	useEffect(() => subscribe(refresh), []);
	useEffect(() => {
		setQuery('');
		setChannel('');
		setPage(0);
	}, [user]);
	const results = user && user === currentAccount() ? findSaved(query, channel.trim()) : [];
	const shown = results.slice(page * 20, page * 20 + 20);
	return (
		<Discord.ActionSheet startExpanded>
			<ScrollView
				style={{ maxHeight: 580 }}
				contentContainerStyle={{ gap: 16, padding: 16 }}
				keyboardShouldPersistTaps='handled'
			>
				<Discord.Text variant='text-lg/semibold'>Saved Message Archive</Discord.Text>
				<Discord.Text variant='text-sm/normal'>
					{archiveState().status} · Account {user || 'signed out'}
				</Discord.Text>
				<TextInput
					accessibilityLabel='Search saved messages'
					placeholder='Search text, user, message ID, edited or deleted'
					placeholderTextColor='#b5bac1'
					style={{
						color: '#f2f3f5',
						padding: 10,
						backgroundColor: '#292b30',
						borderRadius: 6,
					}}
					value={query}
					onChangeText={(v) => {
						setQuery(v);
						setPage(0);
					}}
					autoCapitalize='none'
					autoCorrect={false}
					maxLength={1000}
				/>
				<TextInput
					accessibilityLabel='Filter saved channel'
					placeholder='Exact channel ID (optional)'
					placeholderTextColor='#b5bac1'
					style={{
						color: '#f2f3f5',
						padding: 10,
						backgroundColor: '#292b30',
						borderRadius: 6,
					}}
					value={channel}
					onChangeText={(v) => {
						setChannel(v);
						setPage(0);
					}}
					keyboardType='number-pad'
					maxLength={24}
				/>
				<Discord.Text variant='text-sm/normal'>
					{results.length} matching events · page {page + 1}
				</Discord.Text>
				{shown.map((e, i) => (
					<View key={`${e.capturedAt}-${e.messageId}-${i}`} style={{ gap: 4 }}>
						<Discord.Text variant='text-sm/semibold'>
							{e.kind.toUpperCase()} · {new Date(e.capturedAt).toLocaleString()}
						</Discord.Text>
						<Discord.Text variant='text-xs/normal' selectable>
							{e.before.authorName} ({e.before.authorId}) · Channel {e.channelId} ·
							Message {e.messageId}
						</Discord.Text>
						<Discord.Text variant='text-md/normal' selectable>
							{e.kind === 'edited' ? 'Before: ' : ''}
							{e.before.content || '(no text)'}
						</Discord.Text>
						{e.before.attachments.length > 0 && (
							<Discord.Text variant='text-xs/normal' selectable>
								File names: {e.before.attachments.join(', ')}
							</Discord.Text>
						)}
						{e.after && (
							<Discord.Text variant='text-md/normal' selectable>
								After: {e.after.content || '(no text)'}
							</Discord.Text>
						)}
						{!!e.after?.attachments.length && (
							<Discord.Text variant='text-xs/normal' selectable>
								File names after: {e.after.attachments.join(', ')}
							</Discord.Text>
						)}
					</View>
				))}
				{!shown.length && (
					<Discord.Text variant='text-md/normal'>No saved events match.</Discord.Text>
				)}
				{page > 0 && (
					<Discord.TableRow
						label='Previous page'
						onPress={() => setPage((p) => Math.max(0, p - 1))}
					/>
				)}
				{(page + 1) * 20 < results.length && (
					<Discord.TableRow label='Next page' onPress={() => setPage((p) => p + 1)} />
				)}
				<Discord.Text variant='text-xs/normal'>
					Local, unencrypted history. Attachment names only. Uncaptured messages cannot be
					recovered.
				</Discord.Text>
			</ScrollView>
		</Discord.ActionSheet>
	);
}
export function closeSavedArchive(): void {
	if (openKey) ActionSheets.hideActionSheet(openKey);
	openKey = undefined;
}
export function openSavedArchive(): void {
	closeSavedArchive();
	// Match the official logger's openLazy history-sheet pattern exactly.
	const key = `persistent-message-archive-${Date.now()}`;
	openKey = key;
	ActionSheets.openLazy(
		Promise.resolve({ default: () => <ArchiveSheet /> }),
		key,
		{
			onClose: () => {
				ActionSheets.hideActionSheet(key);
				if (openKey === key) openKey = undefined;
			},
		},
		{ initialSnapIndex: 1 },
	);
}
