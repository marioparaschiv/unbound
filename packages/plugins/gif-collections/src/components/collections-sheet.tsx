import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { BottomSheets, GorhomSheet } from '@unbound-app/api/metro/components';
import { assets, dialogs, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { createCollection, deleteCollection, holds, toggleGif, type Gif } from '~/lib/collections';
import { getCollections, saveCollections, useCollections } from '~/lib/store';
import { openNewCollectionDialog } from '~/components/new-collection-dialog';

import useStyles from '~/components/collections-sheet.style';

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
	const styles = useStyles();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;
	const collections = useCollections();
	const ActionSheetRow = getActionSheetRow();
	const checkIcon = assets.getIdByName('CheckmarkLargeIcon');
	const folderIcon = assets.getIdByName('FolderIcon');
	const plusIcon = assets.getIdByName('FolderPlusIcon');

	function create(name: string) {
		saveCollections(createCollection(getCollections(), name, gif));
		toasts.success('ADDED_TO', { name: name.trim() });
		onClose();
	}

	return (
		<ActionSheet scrollable>
			<BottomSheetTitleHeader
				title={messages.ADD_TO_COLLECTION}
				subtitle={collections.length ? messages.HOLD_TO_DELETE : messages.NO_COLLECTIONS}
			/>
			<ScrollView contentContainerStyle={styles.body}>
				<ActionSheetRow.Group>
					{collections.map((collection) => (
						<ActionSheetRow
							key={collection.name}
							label={collection.name}
							subLabel={format('GIF_COUNT', { count: collection.gifs.length })}
							icon={
								folderIcon ? <ActionSheetRow.Icon source={folderIcon} /> : undefined
							}
							trailing={
								holds(collection, gif) && checkIcon ? (
									<ActionSheetRow.Icon source={checkIcon} />
								) : undefined
							}
							onPress={() => toggle(collection.name, gif)}
							onLongPress={() => void confirmDelete(collection.name)}
						/>
					))}
					<ActionSheetRow
						label={messages.NEW_COLLECTION}
						icon={plusIcon ? <ActionSheetRow.Icon source={plusIcon} /> : undefined}
						onPress={() => openNewCollectionDialog(create)}
					/>
				</ActionSheetRow.Group>
			</ScrollView>
		</ActionSheet>
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
