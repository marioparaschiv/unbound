import type { Feature, SelfTestResult } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { metro } from '@unbound-app/api';

import { patchMediaModalYoutubeEmbedError } from '~/youtube-embeds/embed-error';
import { MediaModalYoutube, MediaModalYoutubeEmbedError } from '~/youtube-embeds/modules';
import { patchMediaModalYoutube } from '~/youtube-embeds/media-modal-youtube';
import { loadSelfTest } from '~/youtube-embeds/load-status';
import { loadStatus } from '~/youtube-embeds/viewer-state';
import { EMBED_ERROR_MODULE, EMBED_ERROR_PATH, YOUTUBE_MODULE, YOUTUBE_PATH } from '~/constants';

function trackLoad(path: string, name: string) {
	metro.onModuleLoaded(metro.filters.byFilePath(path), () => void loadStatus.markLoaded(name), {
		interop: false,
	});
}

/**
 * @description Plays blocked YouTube videos in the media viewer through YouTube's own embed.
 * Patches the render of `MediaModalYoutube` and `MediaModalYoutubeEmbedError`, and reads `WebView` from
 * `react-native-webview`. The Addon scope removes the patches and load listeners when the plugin stops.
 * One patch throwing, for example on an unexpected component shape, does not stop the other.
 */
export const youtubeEmbedFeatures: Feature[] = [
	() => {
		if (!ensureModules({ MediaModalYoutube }, YOUTUBE_MODULE)) return;

		patchMediaModalYoutube();
		trackLoad(YOUTUBE_PATH, YOUTUBE_MODULE);
	},
	() => {
		if (!ensureModules({ MediaModalYoutubeEmbedError }, EMBED_ERROR_MODULE)) return;

		patchMediaModalYoutubeEmbedError();
		trackLoad(EMBED_ERROR_PATH, EMBED_ERROR_MODULE);
	},
];

/**
 * @description Reports the plugin as working once Discord has loaded the modules it patches.
 * @param features The features' own self-test result.
 * @returns That result, or a failure naming the modules not patched yet.
 */
export function selfTestYoutubeEmbeds(features: SelfTestResult) {
	return loadSelfTest(features, loadStatus.pending());
}
