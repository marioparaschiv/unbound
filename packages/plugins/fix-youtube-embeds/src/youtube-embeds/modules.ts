import { metro } from '@unbound-app/api';
import type { ComponentType } from 'react';

import { pickWebView, type WebViewProps } from '~/youtube-embeds/webview';
import { EMBED_ERROR_PATH, YOUTUBE_PATH } from '~/constants';

const WebViewModule = metro.findByProps('WebView', { interop: false });

export const MediaModalYoutube = metro.findByFilePath(YOUTUBE_PATH, { interop: false });
export const MediaModalYoutubeEmbedError = metro.findByFilePath(EMBED_ERROR_PATH, {
	interop: false,
});

/**
 * @description Reads `react-native-webview`'s `WebView` when the player renders.
 * @returns The component, or `undefined` when this build ships none.
 */
export function webViewComponent(): ComponentType<WebViewProps> | undefined {
	return pickWebView(WebViewModule);
}
