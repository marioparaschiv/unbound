import { skipFeature } from '@unbound-plugins/shared/lifecycle/features';
import type { NativePluginBridge } from '@unbound-app/api/native';

import type { Embeds, Renderers } from '~/embeds/modules';
import { createAndroidEmbeds } from '~/embeds/android/embeds';

/**
 * @description Embeds linked messages into Android message text through the loader's native text rewrites.
 * @param native The plugin's native bridge.
 * @param renderers Discord's message renderers.
 * @returns How many embeds are drawn and `dispose`, or `undefined` when the embed surface or the text rewrites are unavailable.
 */
export function startEmbeds(native: NativePluginBridge, renderers: Renderers): Embeds | undefined {
	const android = createAndroidEmbeds(native, renderers);

	if (!android) {
		skipFeature('the embed surface or the native text rewrites are unavailable');

		return;
	}

	return { drawn: android.drawn, dispose: android.dispose };
}
