import { metro, patcher } from '@unbound-app/api';

import { asFavoritableSource, type MediaSource } from '~/lib/media-source';

type FavoriteButtonProps = { source?: MediaSource };

let rendering = false;

/**
 * @description Shows Discord's favorite star in the media viewer for every image and video, not only GIFs. While
 * `MediaViewerOverlayButtonFavoriteGIF` renders, `isAnimatedImageSource` answers yes, and videos are passed as GIFVs.
 */
export function patchFavoriteButton(): void {
	const Button = metro.findByFilePath(
		'modules/media_viewer/native/components/overlay/MediaViewerOverlayButtonFavoriteGIF.tsx',
	)?.default;
	const Sources = metro.findByProps('isAnimatedImageSource', 'extractMediaFromAttachment');

	if (typeof Button?.type !== 'function' || !Sources) {
		logger.warn(
			'Media favorites skipped: Discord moved its favorite GIF button or media sources.',
		);

		return;
	}

	patcher.instead(
		Sources,
		'isAnimatedImageSource',
		({ args, original }) => rendering || original(...args),
	);
	patcher.react.before(Button, 'type', ({ props }) => {
		rendering = true;

		const { source } = props as FavoriteButtonProps;

		return source ? { ...(props as object), source: asFavoritableSource(source) } : undefined;
	});
	patcher.react.after(Button, 'type', ({ result }) => {
		rendering = false;

		return result;
	});
}
