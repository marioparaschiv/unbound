import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { showsYoutube, withAdblock } from '~/webview/injection';
import { buildAdblockScript } from '~/webview/adblock-script';
import { WebViewModule } from '~/webview/modules';

/**
 * @description Injects the ad blocker into every `react-native-webview` `WebView` that shows YouTube: the media viewer's YouTube player, Fix Youtube Embeds' player, and activities such as Watch Together.
 * Patches the render of the `WebView` export of the `react-native-webview` module; other `WebView`s render unchanged.
 * The Addon scope removes the patch when the plugin stops.
 */
export function startWebViewAdblock(): void {
	if (!ensureModules('Youtube Adblock', { WebViewModule })) return;

	const adblock = buildAdblockScript();

	patcher.react.before(WebViewModule, 'WebView', ({ props }) => {
		if (!showsYoutube(props)) return;

		return withAdblock(props, adblock);
	});

	recordApplied(1);
}
