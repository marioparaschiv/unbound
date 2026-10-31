import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import type { NativePluginBridge } from '@unbound-app/api/native';

import type { Embeds, Renderers } from '~/modules';
import { createNativeEmbeds } from '~/android/native-embeds';
import { createAndroidEmbeds } from '~/android/embeds';
import { mediaPatches } from '~/patches/media';

/**
 * @description Embeds linked messages into Android message views, through the native text rewrites when the loader has them.
 * @param native The plugin's native bridge.
 * @param renderers Discord's message renderers.
 * @returns How many embeds are drawn and `dispose`, or `undefined` when the embed surface did not register.
 */
export function startEmbeds(native: NativePluginBridge, renderers: Renderers): Embeds | undefined {
	const android = createNativeEmbeds(native, renderers) ?? createAndroidEmbeds(native, renderers);

	if (!android) {
		console.error('[Message Link Embeds] Skipped, the embed surface did not register.');

		return;
	}

	return {
		drawn: android.drawn,
		dispose: applyFeatures('Message Link Embeds', [() => android.dispose, ...mediaPatches]),
	};
}
