import { onMediaShareActions, Patcher, type MediaShareActions } from '~/modules';
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
 * @returns A function that stops waiting for more copies of the actions and removes the patches.
 */
export function patchMediaShareActions(): () => void {
	const unpatches: (() => void)[] = [];

	function patch(module: MediaShareActions) {
		const unpatch = Patcher.before(module, 'useMediaShareActions', ({ args }) => {
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
		});

		unpatches.push(unpatch);
	}

	const stop = onMediaShareActions(patch);

	return () => {
		stop();

		for (const unpatch of unpatches.splice(0)) unpatch();
	};
}
