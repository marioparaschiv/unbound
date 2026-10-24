import { findMediaShareActions, Patcher } from '~/modules';
import { isRecord, type MediaRecord } from '~/media-record';
import { getPreferredGifUrl } from '~/gif-url';
import { resolveKlipyGifUrl } from '~/klipy';

function pointAtGif(source: MediaRecord, gifUrl: string) {
	source.uri = gifUrl;
	source.sourceURI = gifUrl;
	source.contentType = 'image/gif';
	delete source.videoURI;
	delete source.isGIFV;
}

/**
 * @description Points the media viewer's share and save actions at the GIF instead of its video rendition.
 * @returns A function that removes the patches.
 */
export function patchMediaShareActions(): () => void {
	const modules = [...new Set(findMediaShareActions())];

	if (!modules.length) {
		console.error(
			'[Fix GIF Downloads: share actions] Skipped, modules not found: useMediaShareActions.',
		);

		return () => {};
	}

	const unpatches = modules.map((module) =>
		Patcher.before(module, 'useMediaShareActions', ({ args }) => {
			const [options] = args;

			if (!isRecord(options) || !isRecord(options.source)) return;

			const { source } = options;
			const gifUrl = getPreferredGifUrl(source);

			if (gifUrl) {
				pointAtGif(source, gifUrl);

				return;
			}

			void resolveKlipyGifUrl(source).then((resolved) => {
				if (resolved) pointAtGif(source, resolved);
			});
		}),
	);

	return () => {
		for (const unpatch of unpatches) unpatch();
	};
}
