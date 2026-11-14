export type FolderIcons = Record<string, string>;

const isFolderIcons = (value: unknown): value is FolderIcons =>
	typeof value === 'object' &&
	value !== null &&
	!Array.isArray(value) &&
	Object.values(value).every((icon) => typeof icon === 'string');

/**
 * @description Reads the saved custom folder icons.
 * @param saved The `folderIcons` setting, JSON of folder ids to image URIs.
 * @returns Each folder's icon; empty when nothing valid is saved.
 */
export function parseFolderIcons(saved: string): FolderIcons {
	if (!saved) return {};

	try {
		const icons: unknown = JSON.parse(saved);

		return isFolderIcons(icons) ? icons : {};
	} catch {
		return {};
	}
}

/**
 * @description Sets or removes one folder's custom icon.
 * @param saved The `folderIcons` setting.
 * @param folderId The folder.
 * @param uri The image URI, or `undefined` to go back to Discord's icon.
 * @returns The setting to save.
 */
export function withCustomIcon(saved: string, folderId: string, uri: string | undefined): string {
	const { [folderId]: _previous, ...icons } = parseFolderIcons(saved);

	return JSON.stringify(uri ? { ...icons, [folderId]: uri } : icons);
}

/**
 * @description Builds the URI a picked photo is saved as.
 * @param base64 The photo, base64 encoded.
 * @param type The photo's MIME type, when the picker reports one.
 * @returns A `data:` URI.
 */
export function photoUri(base64: string, type = 'image/jpeg'): string {
	return `data:${type};base64,${base64}`;
}
