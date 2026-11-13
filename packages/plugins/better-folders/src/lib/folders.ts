/** One entry of a folder's content in Discord's guild bar: the open folder's icon or the closed folder's server preview. */
export type FolderItem = { type?: string; tintStyle?: { tintColor?: string } };

const BLURPLE = 0x5865f2;

/**
 * @description Picks the folders to close when one opens.
 * @param opened The folder that just opened.
 * @param expanded The folders open now, the opened one included.
 * @returns The other open folders.
 */
export function othersToClose(opened: number | string, expanded: Iterable<number | string>) {
	return [...expanded].filter((folderId) => String(folderId) !== String(opened));
}

/**
 * @description Turns a closed folder's server preview into the folder icon Discord shows on an open folder, tinted with the
 * folder's color.
 * @param items The folder's content items.
 * @param color The folder's color, or `null` for Discord's default.
 * @returns The items to show; the same array when there is no preview.
 */
export function withFolderIcon(
	items: FolderItem[],
	color: number | null | undefined,
): FolderItem[] {
	if (!items.some((item) => item.type === 'preview')) return items;

	const tintColor = `#${(color ?? BLURPLE).toString(16).padStart(6, '0')}`;

	return items.map((item) =>
		item.type === 'preview' ? { type: 'icon', tintStyle: { tintColor } } : item,
	);
}
