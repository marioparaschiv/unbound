import { metro, patcher } from '@unbound-app/api';

import { showsYoutube, withAdblock } from '~/lib/injection';
import { buildAdblockScript } from '~/lib/adblock-script';

/**
 * @description Injects the ad blocker into every `react-native-webview` `WebView` that shows YouTube: the media viewer's YouTube player, Fix Youtube Embeds' player, and activities such as Watch Together.
 * Patches the render of the `WebView` export of the `react-native-webview` module; other `WebView`s render unchanged.
 */
export function patchWebView(): void {
	const WebViewModule = metro.findByProps('WebView');

	if (!WebViewModule) {
		logger.warn('WebView ad blocker skipped: Discord moved WebViewModule.');

		return;
	}

	const webView = WebViewModule.WebView;

	if (!webView) {
		logger.warn('WebView ad blocker skipped: WebView has no render function.');

		return;
	}

	if (webView.prototype?.isReactComponent) {
		logger.warn('WebView ad blocker skipped: WebView is a class component.');

		return;
	}

	const adblock = buildAdblockScript();

	patcher.react.before(WebViewModule, 'WebView', ({ props }) => {
		if (!showsYoutube(props)) return;

		return withAdblock(props, adblock);
	});
}
