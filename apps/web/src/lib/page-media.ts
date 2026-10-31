import type { AddonPage, MeasuredMedia } from '@unbound-app/contracts/addon-page';
import { thumbHashToDataURL } from 'thumbhash';

import { resolveMediaUrl } from '~/lib/markdown-url';

/** A measured media file, the URL it loads from and the image shown until it does. */
export type ResolvedMedia = MeasuredMedia & {
	src: string;
	/** The ThumbHash decoded to a PNG data URL. */
	placeholder: string;
};

/** Every media file a page measured, by the path ADDON.md writes it as. */
export type PageMediaMap = ReadonlyMap<string, ResolvedMedia>;

function decodeThumbhash(thumbhash: string): string {
	return thumbHashToDataURL(Uint8Array.from(atob(thumbhash), (char) => char.charCodeAt(0)));
}

/**
 * @description Resolves every media file of a measured store page under a media base.
 * @param page The page as `ubd build` measured it.
 * @param base The directory URL the addon's `media/` folder sits in.
 * @returns The media by path; a path that does not resolve is left out.
 */
export function resolvePageMedia(page: AddonPage, base: string): PageMediaMap {
	const resolved = new Map<string, ResolvedMedia>();

	for (const media of page.media) {
		const src = resolveMediaUrl(media.path, base);

		if (!src) {
			continue;
		}

		resolved.set(media.path, { ...media, src, placeholder: decodeThumbhash(media.thumbhash) });
	}

	return resolved;
}

export default { resolvePageMedia };
