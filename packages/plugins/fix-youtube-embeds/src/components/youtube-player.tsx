import { type GestureResponderEvent, Linking, StyleSheet, View } from 'react-native';
import { type ComponentType, useContext, useEffect, useRef } from 'react';

import type { WebViewHandle, WebViewNavigation, WebViewProps } from '~/webview';
import { pauseScript, playerHtml, staysInPlayer } from '~/player';
import { isTap, type TouchPoint } from '~/tap';
import { ViewerContext } from '~/viewer-state';
import { PLAYER_BASE_URL } from '~/constants';

const styles = StyleSheet.create({
	container: {
		width: '100%',
		maxHeight: '100%',
		aspectRatio: 16 / 9,
		alignSelf: 'center',
		backgroundColor: '#000',
	},
	player: {
		flex: 1,
		backgroundColor: '#000',
	},
});

const ALL_ORIGINS = ['*'];

function routeNavigation({ url, isTopFrame }: WebViewNavigation): boolean {
	if (staysInPlayer(url, isTopFrame)) return true;

	Linking.openURL(url).catch((error: unknown) =>
		console.error('[Fix Youtube Embeds] Could not open link:', error),
	);

	return false;
}

function touchPoint({ nativeEvent }: GestureResponderEvent): TouchPoint {
	return { x: nativeEvent.pageX, y: nativeEvent.pageY, time: nativeEvent.timestamp };
}

function usePauseWhenHidden(visible: boolean) {
	const webView = useRef<WebViewHandle>(null);

	useEffect(() => {
		if (!visible) webView.current?.injectJavaScript(pauseScript());
	}, [visible]);

	return webView;
}

function useOverlayTap(onToggleOverlay: (() => unknown) | undefined) {
	const start = useRef<TouchPoint | undefined>(undefined);

	function onTouchStart(event: GestureResponderEvent) {
		start.current = event.nativeEvent.touches.length > 1 ? undefined : touchPoint(event);
	}

	function onTouchEnd(event: GestureResponderEvent) {
		const tapped = isTap(start.current, touchPoint(event));

		start.current = undefined;

		if (tapped) onToggleOverlay?.();
	}

	return { onTouchStart, onTouchEnd };
}

type YoutubePlayerProps = {
	videoId: string;
	WebView: ComponentType<WebViewProps>;
};

/**
 * @description Plays a YouTube video in YouTube's own embed, loaded from youtube-nocookie.com, in place of Discord's embed error.
 * It pauses when the media viewer moves to another item and, like Discord's player, shows or hides the viewer's controls on a tap.
 * @param props The video id and the `WebView` component to play it in.
 * @returns The player.
 */
export function YoutubePlayer({ videoId, WebView }: YoutubePlayerProps) {
	const { visible, onToggleOverlay } = useContext(ViewerContext);
	const webView = usePauseWhenHidden(visible);
	const touches = useOverlayTap(onToggleOverlay);

	return (
		<View style={styles.container} {...touches}>
			<WebView
				ref={webView}
				source={{ html: playerHtml(videoId), baseUrl: PLAYER_BASE_URL }}
				style={styles.player}
				originWhitelist={ALL_ORIGINS}
				javaScriptEnabled
				domStorageEnabled
				allowsInlineMediaPlayback
				allowsFullscreenVideo
				allowsPictureInPictureMediaPlayback
				setSupportMultipleWindows={false}
				onShouldStartLoadWithRequest={routeNavigation}
			/>
		</View>
	);
}

export default YoutubePlayer;
