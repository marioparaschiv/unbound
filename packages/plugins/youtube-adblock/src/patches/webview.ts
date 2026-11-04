import { findRenderTarget, type RenderTarget } from '@unbound-plugins/shared/react/render-target';
import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';

import { showsYoutube, withAdblock } from '~/injection';
import { buildAdblockScript } from '~/adblock-script';
import { PLUGIN_NAME } from '~/constants';
import { WebViewModule } from '~/modules';

function skip(reason: string): void {
	console.error(`[${PLUGIN_NAME}] Skipped, ${reason}.`);
	recordSkip(reason);
}

function isClassComponent(target: RenderTarget): boolean {
	return Boolean(target.holder[target.key]?.prototype?.isReactComponent);
}

function exportKeys(module: AnyProps, target: RenderTarget): string[] {
	if (target.holder !== module) return [target.key];

	return module.default === module.WebView ? ['WebView', 'default'] : ['WebView'];
}

function patchRender(holder: AnyProps, key: string, adblock: string): () => void {
	return patcher.before(holder, key, ({ args }) => {
		const [props, ...rest] = args;

		if (!showsYoutube(props)) return;

		return [withAdblock(props, adblock), ...rest];
	});
}

/**
 * @description Injects the ad blocker into every `react-native-webview` `WebView` that shows YouTube, once the module loads: the media viewer's YouTube player, Fix Youtube Embeds' player, and activities such as Watch Together.
 * Other `WebView`s render unchanged.
 * @returns A function that stops waiting for the module and removes the patch.
 */
export function patchWebView(): () => void {
	return whenLoaded<AnyProps>(
		WebViewModule,
		(module) => {
			const target = findRenderTarget(module, 'WebView');

			if (!target) return skip('WebView has no render function');

			if (isClassComponent(target)) return skip('WebView is a class component');

			const adblock = buildAdblockScript();
			const unpatches = exportKeys(module, target).map((key) =>
				patchRender(target.holder, key, adblock),
			);

			return () => {
				for (const unpatch of unpatches) unpatch();
			};
		},
		{ interop: false },
	);
}

export default patchWebView;
