import { patcher } from '@unbound-app/api';

import { isRecord, type MediaRecord } from '~/media-record';
import { findMediaShareActions } from '~/modules';
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
 */
export function patchMediaShareActions(): void {
	const modules = [...new Set(findMediaShareActions())];

	if (!modules.length) {
		console.error(
			'[Fix GIF Downloads: share actions] Skipped, modules not found: useMediaShareActions.',
		);

		return;
	}

	for (const module of modules) {
		patcher.before(module, 'useMediaShareActions', ({ args }) => {
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
	}
}
