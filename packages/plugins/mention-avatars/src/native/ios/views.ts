import hookMessageCells from '@unbound-plugins/shared/native/ios/message-cell-hooks';
import type { NativeBridge } from '@unbound-app/api/native';

import { createVisibleCellScanner } from '~/native/ios/visible-cells';
import { listenToSelectedChannel } from '~/flux/listeners';
import type { MentionIndex } from '~/lib/mention-index';
import { createRenderer } from '~/native/ios/renderer';

/**
 * @description Draws mention images into Discord's iOS message cells. The native scope removes the cell hooks.
 * @param native The plugin's native bridge.
 * @param index The mention index the renderer reads.
 * @param showAtSymbol Reads whether a mention keeps its `@` beside the image.
 * @returns The renderer's health readers, `retryWaiting`, and `dispose`, which restores every rewritten text view.
 */
export function drawMentions(
	{ objc }: NativeBridge,
	index: MentionIndex,
	showAtSymbol: () => boolean,
) {
	const renderer = createRenderer(objc, index, showAtSymbol);
	const scanner = createVisibleCellScanner(objc, renderer.schedule);

	hookMessageCells(objc, {
		shown: renderer.schedule,
		laidOut: renderer.schedule,
		reused: renderer.reuse,
		textChanged: renderer.schedule,
	});
	listenToSelectedChannel(renderer, scanner);

	return {
		rendered: renderer.rendered,
		failed: renderer.failed,
		settling: renderer.settling,
		retryWaiting: renderer.retryWaiting,
		dispose: renderer.dispose,
	};
}

export default drawMentions;
