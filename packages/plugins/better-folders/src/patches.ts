import { flux, metro, patcher, utils } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { isValidElement, type ReactElement } from 'react';

import { othersToClose, withFolderIcon, type FolderItem } from '~/lib/folders';
import '~/lib/types';

type FolderAction = { folderId?: number | string; expanded?: boolean };

type FolderProps = { id?: number | string; expanded?: boolean; color?: number | null };

type ItemsElement = ReactElement<{ items: FolderItem[] }>;

const isItemsElement = (node: unknown): node is ItemsElement =>
	isValidElement(node) && Array.isArray((node.props as { items?: unknown }).items);

function closeOthers({ folderId }: FolderAction): void {
	const Folders = flux.getStore('ExpandedGuildFolder');

	if (folderId == null || !Folders.isFolderExpanded(folderId)) return;

	queueMicrotask(() => {
		for (const other of othersToClose(folderId, Folders.getExpandedFolders())) {
			void flux.dispatch({
				type: 'SET_GUILD_FOLDER_EXPANDED',
				folderId: other,
				expanded: false,
			});
		}
	});
}

/**
 * @description Closes the other server folders when one opens. Listens to `TOGGLE_GUILD_FOLDER_EXPAND` and
 * `SET_GUILD_FOLDER_EXPANDED` after `ExpandedGuildFolderStore` handles them.
 */
export function listenForOpenedFolders(): void {
	if (!settings.autoCollapse) return;

	flux.onAction('TOGGLE_GUILD_FOLDER_EXPAND', (action) => closeOthers(action as FolderAction));
	flux.onAction('SET_GUILD_FOLDER_EXPANDED', (action) => {
		if ((action as FolderAction).expanded) closeOthers(action as FolderAction);
	});
}

/**
 * @description Shows a folder icon in the folder's color instead of its servers on closed folders. Patches the render of
 * Discord's `GuildsBarGuildFolder` and swaps the server preview item for the icon item an open folder uses.
 */
export function patchClosedFolders(): void {
	if (!settings.hideIcons) return;

	const Folder = metro.findByFilePath(
		'modules/guilds_bar/native/GuildsBarGuildFolder.tsx',
	)?.default;

	if (typeof Folder?.type !== 'function') {
		logger.warn('Hidden folder icons skipped: Discord moved GuildsBarGuildFolder.');

		return;
	}

	patcher.react.after(Folder, 'type', ({ props, result }) => {
		const { expanded, color } = props as FolderProps;

		if (expanded) return result;

		const content = utils.react.findInTree(result, isItemsElement) as ItemsElement | undefined;

		if (!content) return result;

		content.props.items = withFolderIcon(content.props.items, color);

		return result;
	});
}
