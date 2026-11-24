import type { ZipEntry } from '~/lib/zip';

const ICONS: [RegExp, string][] = [
	[/\.(png|jpe?g|gif|webp|bmp|svg|ico|heic|avif|tiff?)$/i, 'ImageIcon'],
	[/\.(mp4|mov|webm|mkv|avi|m4v)$/i, 'VideoIcon'],
	[/\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i, 'MusicIcon'],
	[/\.(zip|jar|apk|ipa|xpi|rar|7z|tar|gz)$/i, 'FolderIcon'],
];

/**
 * @description Finds the folder every entry sits in, so rows can leave it out.
 * @param entries The archive's files.
 * @returns The shared folder with its trailing slash, or `''` when the files do not share one.
 */
export function sharedRoot(entries: ZipEntry[]): string {
	const first = entries[0]?.name;
	const slash = first?.indexOf('/') ?? -1;

	if (!first || slash < 0) return '';

	const root = first.slice(0, slash + 1);

	return entries.every((entry) => entry.name.startsWith(root)) ? root : '';
}

/**
 * @description Names Discord's icon for a file by its extension.
 * @param name The file's path in the archive.
 * @returns The icon's asset name; `FileIcon` for anything else.
 */
export function entryIcon(name: string): string {
	return ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? 'FileIcon';
}

export default sharedRoot;
