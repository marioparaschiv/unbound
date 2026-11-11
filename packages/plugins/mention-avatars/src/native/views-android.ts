import type { NativePluginBridge } from '@unbound-app/api/native';

import { createAndroidRenderer } from '~/native/renderer-android';
import type { MentionIndex } from '~/lib/mention-index';

/**
 * @description Draws mention images into Discord's Android message text.
 * @param native The plugin's native bridge.
 * @param index The mention index the renderer reads.
 * @param showAtSymbol Reads whether a user mention keeps its `@` beside the image.
 * @returns The renderer's health readers, `retryWaiting`, and `dispose`, which removes its text rewrites.
 */
export function drawMentions(
	native: NativePluginBridge,
	index: MentionIndex,
	showAtSymbol: () => boolean,
) {
	const renderer = createAndroidRenderer(native, index, showAtSymbol);

	return {
		rendered: renderer.rendered,
		failed: renderer.failed,
		settling: renderer.settling,
		retryWaiting: renderer.retryWaiting,
		dispose: renderer.dispose,
	};
}

export default drawMentions;
