import {
	featureSelfTest,
	recordApplied,
	recordFailure,
} from '@unbound-plugins/shared/lifecycle/health';
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
export function startYoutubeEmbeds(): void {
	const failures = [
		startPatch(YOUTUBE_MODULE, { MediaModalYoutube }, () => {
			patchMediaModalYoutube();
			trackLoad(YOUTUBE_PATH, YOUTUBE_MODULE);
		}),
		startPatch(EMBED_ERROR_MODULE, { MediaModalYoutubeEmbedError }, () => {
			patchMediaModalYoutubeEmbedError();
			trackLoad(EMBED_ERROR_PATH, EMBED_ERROR_MODULE);
		}),
	];

	// Recorded last: applying a feature clears an earlier failure.
	for (const failure of failures) if (failure) recordFailure(failure);
}

// One patch throwing, for example on an unexpected component shape, must not stop the other.
function startPatch(
	name: string,
	modules: Record<string, unknown>,
	patch: () => void,
): string | undefined {
	if (!ensureModules(`${PLUGIN_NAME}: ${name}`, modules)) return;

	try {
		patch();
		recordApplied(1);
	} catch (error) {
		console.error(`[${PLUGIN_NAME}] Failed to patch ${name}:`, error);

		return `${name}: ${error instanceof Error ? error.message : String(error)}`;
	}
}

/**
 * @description Reports the plugin as working once Discord has loaded the modules it patches.
 * @returns The shared self-test result, or a failure naming the modules not patched yet.
 */
export function selfTestYoutubeEmbeds() {
	return loadSelfTest(featureSelfTest(), loadStatus.pending());
}
