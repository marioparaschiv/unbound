export type PickerItem = { url?: string; src?: string; gifSrc?: string };

export type FavoriteGif = { src?: string };

export type GifFile = { url: string; filename: string; mimeType: string };

/**
 * @description Finds the file behind a GIF the picker sent: the GIF itself when the provider has one, else its video,
 * from the picker's results first, then your favorites.
 * @param link The link the picker would send.
 * @param results The picker's current results.
 * @param favorites Your favorite GIFs, by link.
 * @returns The file's address, or `undefined` when neither knows the GIF.
 */
export function gifMedia(
	link: string,
	results: readonly PickerItem[],
	favorites: Readonly<Record<string, FavoriteGif | undefined>>,
): string | undefined {
	const item = results.find((result) => result.url === link);

	return item?.gifSrc || item?.src || favorites[link]?.src || undefined;
}

function extension(url: string): string {
	const path = url.split(/[?#]/)[0] ?? '';
	const match = /\.(gif|mp4|webm|webp|png)$/i.exec(path);

	return match?.[1]?.toLowerCase() ?? 'gif';
}

const MIME_TYPES: Record<string, string> = {
	gif: 'image/gif',
	mp4: 'video/mp4',
	webm: 'video/webm',
	webp: 'image/webp',
	png: 'image/png',
};

/**
 * @description Names the file to attach after the GIF's link and gives its type.
 * @param link The GIF's page link, whose last part names it.
 * @param media The file's address, whose extension sets the type.
 * @returns The file.
 */
export function gifFile(link: string, media: string): GifFile {
	const ext = extension(media);
	const slug = (link.split(/[?#]/)[0] ?? '').split('/').filter(Boolean).at(-1) ?? 'gif';
	const name = slug.replace(/[^\w-]+/g, '-').slice(0, 60) || 'gif';

	return { url: media, filename: `${name}.${ext}`, mimeType: MIME_TYPES[ext] ?? 'image/gif' };
}
