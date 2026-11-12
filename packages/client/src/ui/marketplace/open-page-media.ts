import type { PageMediaFile } from '~/marketplace/addon-page';
import { Media } from '~/metro/components';

import type { ScreenRect } from './screen-rect-context';

/** One image or video the media viewer pages through, with the poster a video shows before it plays. */
export type ViewerEntry = {
	media: PageMediaFile;
	poster?: PageMediaFile;
};

// The shape Discord's game profile gallery hands the viewer: `videoURI` makes an entry play as a video.
function toSource({ media, poster }: ViewerEntry, index: number) {
	const { url, width, height } = media;

	if (media.kind === 'image') {
		return { uri: url, sourceURI: url, width, height, mediaIndex: index };
	}

	return {
		uri: url,
		videoURI: url,
		width,
		height,
		mediaIndex: index,
		thumbnail: poster
			? { uri: poster.url, width: poster.width, height: poster.height }
			: undefined,
	};
}

/**
 * @description Opens addon page media in Discord's fullscreen viewer, growing out of the view the
 * entry sat in and swiping between every entry.
 * @param entries The images and videos the viewer pages through, in order.
 * @param index The entry it opens on.
 * @param origin The on-screen frame the open animation grows from; without one it zooms from the middle.
 */
export function openPageMedia(
	entries: ViewerEntry[],
	index: number,
	origin: ScreenRect | undefined,
): void {
	Media.openMediaModal({
		initialSources: entries.map(toSource),
		initialIndex: index,
		originViewOrOriginLayout: origin ? { ...origin, resizeMode: 'cover' } : undefined,
	});
}
