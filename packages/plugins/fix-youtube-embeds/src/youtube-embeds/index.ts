import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import startFeatures from '@unbound-plugins/shared/lifecycle/start-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { metro } from '@unbound-app/api';

import { patchMediaModalYoutubeEmbedError } from '~/youtube-embeds/embed-error';
import { MediaModalYoutube, MediaModalYoutubeEmbedError } from '~/youtube-embeds/modules';
import { patchMediaModalYoutube } from '~/youtube-embeds/media-modal-youtube';
import { loadSelfTest } from '~/youtube-embeds/load-status';
import { loadStatus } from '~/youtube-embeds/viewer-state';
import {
	EMBED_ERROR_MODULE,
	EMBED_ERROR_PATH,
	PLUGIN_NAME,
	YOUTUBE_MODULE,
	YOUTUBE_PATH,
} from '~/constants';

function trackLoad(path: string, name: string) {
	metro.onModuleLoaded(metro.filters.byFilePath(path), () => void loadStatus.markLoaded(name), {
		interop: false,
	});
}

/**
 * @description Plays blocked YouTube videos in the media viewer through YouTube's own embed.
 * Patches the render of `MediaModalYoutube` and `MediaModalYoutubeEmbedError`, and reads `WebView` from
 * `react-native-webview`. The Addon scope removes the patches and load listeners when the plugin stops.
 */
export function startYoutubeEmbeds(): () => Promise<void> {
	// One patch throwing, for example on an unexpected component shape, must not stop the other.
	return startFeatures(PLUGIN_NAME, [
		() => {
			if (!ensureModules(`${PLUGIN_NAME}: ${YOUTUBE_MODULE}`, { MediaModalYoutube })) return;

			patchMediaModalYoutube();
			trackLoad(YOUTUBE_PATH, YOUTUBE_MODULE);
		},
		() => {
			if (
				!ensureModules(`${PLUGIN_NAME}: ${EMBED_ERROR_MODULE}`, {
					MediaModalYoutubeEmbedError,
				})
			) {
				return;
			}

			patchMediaModalYoutubeEmbedError();
			trackLoad(EMBED_ERROR_PATH, EMBED_ERROR_MODULE);
		},
	]);
}

/**
 * @description Reports the plugin as working once Discord has loaded the modules it patches.
 * @returns The shared self-test result, or a failure naming the modules not patched yet.
 */
export function selfTestYoutubeEmbeds() {
	return loadSelfTest(featureSelfTest(), loadStatus.pending());
}
