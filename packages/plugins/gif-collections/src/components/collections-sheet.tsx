import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { assets, dialogs, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { View } from 'react-native';
import { useState } from 'react';

import { createCollection, deleteCollection, holds, toggleGif, type Gif } from '~/lib/collections';
import { getCollections, saveCollections, useCollections } from '~/lib/store';

type CollectionsSheetProps = { gif: Gif; onClose: () => void };

function toggle(name: string, gif: Gif) {
	const before = getCollections();
	const added = !before.find((collection) => collection.name === name && holds(collection, gif));

	saveCollections(toggleGif(before, name, gif));
	toasts.success(added ? 'ADDED_TO' : 'REMOVED_FROM', { name });
}

async function confirmDelete(name: string) {
	const confirmed = await dialogs.confirm('DELETE_COLLECTION', {
		titleVars: { name },
		body: 'DELETE_COLLECTION_BODY',
		confirm: 'DELETE',
		destructive: true,
	});

	if (confirmed) saveCollections(deleteCollection(getCollections(), name));
}

function CollectionsSheet({ gif, onClose }: CollectionsSheetProps) {
	const collections = useCollections();
	const [name, setName] = useState('');
	const ActionSheetRow = getActionSheetRow();
	const checkIcon = assets.getIdByName('CheckmarkLargeIcon');
	const folderIcon = assets.getIdByName('FolderIcon');

	function create() {
		saveCollections(createCollection(getCollections(), name, gif));
		toasts.success('ADDED_TO', { name: name.trim() });
		setName('');
		onClose();
	}

	return (
		<Discord.ActionSheet>
			<Discord.Text
				variant='heading-lg/semibold'
				style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}
			>
				{messages.ADD_TO_COLLECTION}
			</Discord.Text>
			<ActionSheetRow.Group>
				{collections.map((collection) => (
					<ActionSheetRow
						key={collection.name}
						label={collection.name}
						subLabel={format('GIF_COUNT', { count: collection.gifs.length })}
						icon={folderIcon ? <ActionSheetRow.Icon source={folderIcon} /> : undefined}
						trailing={
							holds(collection, gif) && checkIcon ? (
								<ActionSheetRow.Icon source={checkIcon} />
							) : undefined
						}
						onPress={() => toggle(collection.name, gif)}
						onLongPress={() => void confirmDelete(collection.name)}
					/>
				))}
				{collections.length ? null : (
					<ActionSheetRow label={messages.NO_COLLECTIONS} onPress={() => undefined} />
				)}
			</ActionSheetRow.Group>
			<View style={{ flexDirection: 'row', gap: 8, padding: 16, alignItems: 'center' }}>
				<View style={{ flex: 1 }}>
					<Discord.TextField
						size='md'
						value={name}
						onChange={setName}
						isClearable
						isRound
						placeholder={messages.NEW_COLLECTION}
						onSubmitEditing={create}
					/>
				</View>
				<Discord.Button text={messages.CREATE} disabled={!name.trim()} onPress={create} />
			</View>
			{collections.length ? (
				<Discord.Text
					variant='text-xs/medium'
					color='text-muted'
					style={{ paddingHorizontal: 16, paddingBottom: 12 }}
				>
					{messages.HOLD_TO_DELETE}
				</Discord.Text>
			) : null}
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the sheet that adds a GIF to collections, takes it out of them, or starts a new one with it.
 * @param gif The GIF.
 */
export function openCollectionsSheet(gif: Gif): void {
	openSheet(`unbound-gif-collections-${gif.url}`, CollectionsSheet, { gif });
}

export default CollectionsSheet;
