import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import type { NativePluginBridge } from '@unbound-app/api/native';

import { subscribeMentionSources } from '~/events/mention-sources';
import { createAndroidRenderer } from '~/android/renderer';
import { patchRowGenerator } from '~/patches/row-generator';
import type { MentionIndex } from '~/mention-index';

/**
 * @description Draws mention images into Discord's Android message text.
 * @param native The plugin's native bridge.
 * @param index The mention index the renderer reads.
 * @param showAtSymbol Reads whether a user mention keeps its `@` beside the image.
 * @returns The renderer's health readers, and `dispose`, which removes its hook and text rewrites.
 */
export function startMentions(
	native: NativePluginBridge,
	index: MentionIndex,
	showAtSymbol: () => boolean,
) {
	const renderer = createAndroidRenderer(native, index, showAtSymbol);

	return {
		rendered: renderer.rendered,
		failed: renderer.failed,
		settling: renderer.settling,
		dispose: applyFeatures('Mention Avatars', [
			() => renderer.dispose,
			() => patchRowGenerator(index),
			() => subscribeMentionSources(renderer.retryWaiting),
		]),
	};
}

export default startMentions;
