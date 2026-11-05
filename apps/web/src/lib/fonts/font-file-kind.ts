import type { FontFile } from '@unbound-app/contracts/fonts';

const FONT_EXTENSION = /\.(?:ttf|otf)$/i;
const ARCHIVE_EXTENSION = /\.zip$/i;

/**
 * @description Reads what a link's path points at from its extension.
 * @param pathname The link's path.
 * @returns `font`, `archive`, or `undefined` for anything else.
 */
export function fontFileKind(pathname: string): FontFile['kind'] | undefined {
	if (FONT_EXTENSION.test(pathname)) {
		return 'font';
	}

	if (ARCHIVE_EXTENSION.test(pathname)) {
		return 'archive';
	}

	return undefined;
}

/**
 * @description Names a family after a link's file, such as `Inter-Bold` for `.../Inter-Bold.ttf`.
 * @param pathname The link's path.
 * @returns The file name without its extension.
 */
export function familyFromPath(pathname: string): string {
	const file = decodeURIComponent(pathname.split('/').pop() ?? '');

	return file.replace(/\.[^.]+$/, '') || file;
}

/**
 * @description Names a family after a page slug, such as `Bebas Neue` for `bebas-neue`.
 * @param slug The lowercase, dash-separated slug.
 * @returns The slug's words, capitalised.
 */
export function familyFromSlug(slug: string): string {
	return slug
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

export default { familyFromPath, familyFromSlug, fontFileKind };
