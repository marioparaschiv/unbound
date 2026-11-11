import { metro, patcher } from '@unbound-app/api';

import { ViewerContext, loadStatus, type ViewerState } from '~/lib/viewer-state';
import YoutubePlayer from '~/components/youtube-player';
import { pickWebView } from '~/lib/webview';
import { toVideoId } from '~/lib/player';
import {
	EMBED_ERROR_MODULE,
	EMBED_ERROR_PATH,
	YOUTUBE_MODULE,
	YOUTUBE_PATH,
} from '~/lib/constants';

type YoutubeProps = {
	visible?: unknown;
	onToggleOverlay?: unknown;
};

type EmbedErrorProps = {
	videoId?: unknown;
};

function toViewerState(props: YoutubeProps | undefined): ViewerState {
	const onToggleOverlay = props?.onToggleOverlay;

	return {
		visible: props?.visible !== false,
		...(typeof onToggleOverlay === 'function'
			? { onToggleOverlay: onToggleOverlay as ViewerState['onToggleOverlay'] }
			: {}),
	};
}

function trackLoad(path: string, name: string) {
	metro.onModuleLoaded(metro.filters.byFilePath(path), () => void loadStatus.markLoaded(name), {
		interop: false,
	});
}

/**
 * @description Passes the media viewer's `visible` and `onToggleOverlay` props from `MediaModalYoutube` down to the fallback player it may render.
 */
export function patchMediaModalYoutube(): void {
	const MediaModalYoutube = metro.findByFilePath(YOUTUBE_PATH, { interop: false });

	if (!MediaModalYoutube) {
		logger.warn(`Viewer controls skipped: Discord moved ${YOUTUBE_MODULE}.`);

		return;
	}

	patcher.react.after(MediaModalYoutube, 'default', ({ props, result }) => (
		<ViewerContext.Provider value={toViewerState(props as YoutubeProps | undefined)}>
			{result}
		</ViewerContext.Provider>
	));
	trackLoad(YOUTUBE_PATH, YOUTUBE_MODULE);
}

/**
 * @description Replaces the media viewer's "can't be played here" YouTube error with a player that loads the video as if from youtube.com,
 * through `react-native-webview`'s `WebView`. The error stays when its video id is missing or this build ships no `WebView`.
 */
export function patchMediaModalYoutubeEmbedError(): void {
	const MediaModalYoutubeEmbedError = metro.findByFilePath(EMBED_ERROR_PATH, { interop: false });

	if (!MediaModalYoutubeEmbedError) {
		logger.warn(`YouTube player skipped: Discord moved ${EMBED_ERROR_MODULE}.`);

		return;
	}

	const WebViewModule = metro.findByProps('WebView', { interop: false });

	patcher.react.after(MediaModalYoutubeEmbedError, 'default', ({ props, result }) => {
		const videoId = toVideoId((props as EmbedErrorProps | undefined)?.videoId);
		const WebView = videoId ? pickWebView(WebViewModule) : undefined;

		if (!videoId || !WebView) return result;

		return <YoutubePlayer key={videoId} videoId={videoId} WebView={WebView} />;
	});
	trackLoad(EMBED_ERROR_PATH, EMBED_ERROR_MODULE);
}
