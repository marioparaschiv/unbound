import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';

import { EMBED_ERROR_MODULE, EMBED_ERROR_PATH, PLUGIN_NAME } from '~/constants';
import { MediaModalYoutubeEmbedError, webViewComponent } from '~/modules';
import YoutubePlayer from '~/components/youtube-player';
import { loadStatus } from '~/viewer-state';
import { toVideoId } from '~/player';

type EmbedErrorProps = {
	videoId?: unknown;
};

/**
 * @description Replaces the media viewer's "can't be played here" YouTube error with a player that loads the video as if from youtube.com, once `MediaModalYoutubeEmbedError` loads.
 * The error stays when its video id is missing or this build ships no `WebView`.
 * @returns A function that stops waiting for the module and removes the patch.
 */
export function patchMediaModalYoutubeEmbedError(): () => void {
	if (!ensureModules(`${PLUGIN_NAME}: ${EMBED_ERROR_MODULE}`, { MediaModalYoutubeEmbedError })) {
		return () => undefined;
	}

	return whenLoaded<AnyProps>(EMBED_ERROR_PATH, (module) => {
		const target = findRenderTarget(module);

		if (!target) {
			const reason = `${EMBED_ERROR_MODULE} has no render function`;

			console.error(`[${PLUGIN_NAME}] Skipped, ${reason}.`);
			recordSkip(reason);

			return;
		}

		const unpatch = patcher.after(target.holder, target.key, ({ args, result }) => {
			const videoId = toVideoId((args[0] as EmbedErrorProps | undefined)?.videoId);
			const WebView = videoId ? webViewComponent() : undefined;

			if (!videoId || !WebView) return result;

			return <YoutubePlayer key={videoId} videoId={videoId} WebView={WebView} />;
		});
		const unmark = loadStatus.markLoaded(EMBED_ERROR_MODULE);

		return () => {
			unmark();
			unpatch();
		};
	});
}

export default patchMediaModalYoutubeEmbedError;
