import hookMessageCells from '@unbound-plugins/shared/native/ios/message-cell-hooks';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import type { NativePluginBridge } from '@unbound-app/api/native';

import { subscribeSelectedChannel } from '~/events/selected-channel';
import { subscribeMentionSources } from '~/events/mention-sources';
import { createVisibleCellScanner } from '~/ios/visible-cells';
import { patchRowGenerator } from '~/patches/row-generator';
import type { MentionIndex } from '~/mention-index';
import { createRenderer } from '~/ios/renderer';

/**
 * @description Draws mention images into Discord's iOS message cells.
 * @param native The plugin's native bridge.
 * @param index The mention index the renderer reads.
 * @param showAtSymbol Reads whether a mention keeps its `@` beside the image.
 * @returns The renderer's health readers, and `dispose`, which restores every rewritten text view.
 */
export function startMentions(
	{ objc }: NativePluginBridge,
	index: MentionIndex,
	showAtSymbol: () => boolean,
) {
	const renderer = createRenderer(objc, index, showAtSymbol);
	const scanner = createVisibleCellScanner(objc, renderer.schedule);

	return {
		rendered: renderer.rendered,
		failed: renderer.failed,
		settling: renderer.settling,
		dispose: applyFeatures('Mention Avatars', [
			() => renderer.dispose,
			() => patchRowGenerator(index),
			() =>
				hookMessageCells(objc, {
					shown: renderer.schedule,
					laidOut: renderer.schedule,
					reused: renderer.reuse,
					textChanged: renderer.schedule,
				}),
			() => subscribeSelectedChannel(renderer, scanner),
			() => subscribeMentionSources(renderer.retryWaiting),
		]),
	};
}

export default startMentions;
