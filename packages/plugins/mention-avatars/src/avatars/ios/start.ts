import hookMessageCells from '@unbound-plugins/shared/native/ios/message-cell-hooks';
import { startTogether } from '@unbound-plugins/shared/lifecycle/features';
import type { NativePluginBridge } from '@unbound-app/api/native';

import { subscribeSelectedChannel } from '~/avatars/events/selected-channel';
import { createVisibleCellScanner } from '~/avatars/ios/visible-cells';
import type { MentionIndex } from '~/avatars/mention-index';
import { createRenderer } from '~/avatars/ios/renderer';

/**
 * @description Draws mention images into Discord's iOS message cells.
 * @param native The plugin's native bridge.
 * @param index The mention index the renderer reads.
 * @param showAtSymbol Reads whether a mention keeps its `@` beside the image.
 * @returns The renderer's health readers, `retryWaiting`, and `dispose`, which restores every rewritten text view.
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
		retryWaiting: renderer.retryWaiting,
		dispose: startTogether([
			() => renderer.dispose,
			() =>
				hookMessageCells(objc, {
					shown: renderer.schedule,
					laidOut: renderer.schedule,
					reused: renderer.reuse,
					textChanged: renderer.schedule,
				}),
			() => subscribeSelectedChannel(renderer, scanner),
		]),
	};
}

export default startMentions;
