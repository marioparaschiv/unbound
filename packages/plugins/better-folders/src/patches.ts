import type {} from '@unbound-plugins/shared/entities/describe';
import { flux, metro, patcher, toasts, utils } from '@unbound-app/api';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Image } from 'react-native';

import { parseFolderIcons, withCustomIcon } from '~/lib/folder-icons';
import { othersToClose, withFolderIcon, type FolderItem } from '~/lib/folders';
import { pickFolderIcon } from '~/lib/pick-icon';
import '~/lib/types';

type FolderAction = { folderId?: number | string; expanded?: boolean };

type FolderProps = { id?: number | string; expanded?: boolean; color?: number | null };

type RenderItem = (state: unknown, item: FolderItem, ...rest: unknown[]) => ReactNode;

type ItemsElement = ReactElement<{ items: FolderItem[]; renderItem?: RenderItem }>;

type MenuItem = {
	label?: string;
	IconComponent?: unknown;
	action?: () => void;
};

type ContextMenu = {
	key?: unknown;
	items?: MenuItem[];
};

type ContextMenuHost = {
	showContextMenu: (menu?: ContextMenu) => void;
	hideContextMenu: () => void;
};

const CUSTOM_ICON = 'better-folders-icon';

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

function showCustomIcon(content: ItemsElement, uri: string): void {
	const renderItem = content.props.renderItem;

	if (!renderItem) return;

	content.props.items = [{ type: CUSTOM_ICON }];
	content.props.renderItem = (state, item, ...rest) =>
		item.type === CUSTOM_ICON
			? createElement(Image, {
					key: CUSTOM_ICON,
					source: { uri },
					style: { width: '100%', height: '100%' },
				})
			: renderItem(state, item, ...rest);
}

/**
 * @description Draws closed folders with their custom icon, or with a folder icon in their color instead of their
 * servers. Patches the render of Discord's `GuildsBarGuildFolder`, reading the settings as hooks so a change redraws it.
 */
export function patchClosedFolders(): void {
	const Folder = metro.findByFilePath(
		'modules/guilds_bar/native/GuildsBarGuildFolder.tsx',
	)?.default;

	if (typeof Folder?.type !== 'function') {
		logger.warn('Hidden folder icons skipped: Discord moved GuildsBarGuildFolder.');

		return;
	}

	patcher.react.after(Folder, 'type', ({ props, result }) => {
		const { id, expanded, color } = props as FolderProps;
		const folderIcons = useSetting('folderIcons');
		const hideIcons = useSetting('hideIcons');

		if (expanded) return result;

		const content = utils.react.findInTree(result, isItemsElement) as ItemsElement | undefined;

		if (!content) return result;

		const icon = id == null ? undefined : parseFolderIcons(folderIcons)[String(id)];

		if (icon) showCustomIcon(content, icon);
		else if (hideIcons) content.props.items = withFolderIcon(content.props.items, color);

		return result;
	});
}

function saveFolderIcon(folderId: string, uri: string | undefined): void {
	settings.folderIcons = withCustomIcon(settings.folderIcons, folderId, uri);
}

async function setFolderIcon(folderId: string): Promise<void> {
	try {
		const uri = await pickFolderIcon();

		if (uri) saveFolderIcon(folderId, uri);
	} catch (error) {
		logger.error(`Failed to set folder icon ${folderId}:`, error);
		toasts.show({ title: addon.name, content: messages.FOLDER_ICON_FAILED });
	}
}

function folderMenuId(menu: ContextMenu): string | undefined {
	const key = menu.key;

	if (typeof key !== 'string' && typeof key !== 'number') return undefined;

	const folders = flux.getStore('SortedGuild').getGuildFolders();

	return folders.some(
		(folder) => folder.folderId != null && String(folder.folderId) === String(key),
	)
		? String(key)
		: undefined;
}

/**
 * @description Adds Set Folder Icon and Remove Folder Icon to a server folder's long-press menu, by patching
 * `showContextMenu` for menus keyed by a folder id in `SortedGuildStore.getGuildFolders()`.
 */
export function patchFolderMenus(): void {
	const ContextMenus: ContextMenuHost | undefined = metro.findByProps(
		'showContextMenu',
		'hideContextMenu',
	);
	const ImageIcon = metro.findByProps('ImageIcon')?.ImageIcon;
	const TrashIcon = metro.findByProps('TrashIcon')?.TrashIcon;

	if (!ContextMenus || !ImageIcon || !TrashIcon) {
		logger.warn(
			'Folder icon items skipped: Discord moved showContextMenu, ImageIcon or TrashIcon.',
		);

		return;
	}

	patcher.before(ContextMenus, 'showContextMenu', ({ args: [menu] }) => {
		const folderId = menu && Array.isArray(menu.items) ? folderMenuId(menu) : undefined;

		if (!menu?.items || !folderId) return;
		if (menu.items.some((item) => item.label === messages.SET_FOLDER_ICON)) return;

		menu.items.push({
			label: messages.SET_FOLDER_ICON,
			IconComponent: ImageIcon,
			action: () => {
				ContextMenus.hideContextMenu();
				void setFolderIcon(folderId);
			},
		});

		if (!parseFolderIcons(settings.folderIcons)[folderId]) return;

		menu.items.push({
			label: messages.REMOVE_FOLDER_ICON,
			IconComponent: TrashIcon,
			action: () => {
				ContextMenus.hideContextMenu();
				saveFolderIcon(folderId, undefined);
			},
		});
	});
}
