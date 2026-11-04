import { patcher } from '@unbound-app/api';

import { onMediaShareActions, type MediaShareActions } from '~/share/modules';
import { isRecord, type MediaRecord } from '~/gif/media-record';
import { getPreferredGifUrl } from '~/gif/gif-url';
import { resolveKlipyGifUrl } from '~/gif/klipy';

function pointAtGif(source: MediaRecord, gifUrl: string) {
	source.uri = gifUrl;
	source.sourceURI = gifUrl;
	source.contentType = 'image/gif';
	delete source.videoURI;
	delete source.isGIFV;
}

function patch(module: MediaShareActions) {
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

/**
 * @description Points the media viewer's share and save actions at the GIF instead of its video rendition, patching each copy as Discord loads it.
 * Patches `useMediaShareActions` in every copy of the media viewer's share actions module. The Addon scope removes the patches and the load listener when the plugin stops.
 */
export function startShareActions(): void {
	onMediaShareActions(patch);
}
