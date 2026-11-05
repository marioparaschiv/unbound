import { patcher } from '@unbound-app/api';

import { MediaModalYoutubeEmbedError, webViewComponent } from '~/youtube-embeds/modules';
import YoutubePlayer from '~/youtube-embeds/components/youtube-player';
import { toVideoId } from '~/youtube-embeds/player';

type EmbedErrorProps = {
	videoId?: unknown;
};

/**
 * @description Replaces the media viewer's "can't be played here" YouTube error with a player that loads the video as if from youtube.com.
 * The error stays when its video id is missing or this build ships no `WebView`.
 */
export function patchMediaModalYoutubeEmbedError(): void {
	patcher.react.after(MediaModalYoutubeEmbedError, 'default', ({ props, result }) => {
		const videoId = toVideoId((props as EmbedErrorProps | undefined)?.videoId);
		const WebView = videoId ? webViewComponent() : undefined;

		if (!videoId || !WebView) return result;

		return <YoutubePlayer key={videoId} videoId={videoId} WebView={WebView} />;
	});
}
