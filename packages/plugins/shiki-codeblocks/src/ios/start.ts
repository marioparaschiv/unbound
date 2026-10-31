import { messageTextViewClass } from '@unbound-plugins/shared/native/ios/text-attachments';
import ensureClasses from '@unbound-plugins/shared/native/ios/ensure-classes';
import type { NativePluginBridge } from '@unbound-app/api/native';

import { cardProgress, misplacedCards, startRenderer } from '~/ios/renderer';
import { PLUGIN_NAME } from '~/constants';
import type { Cards } from '~/types';

/**
 * @description Draws code cards in Discord's native iOS message cells.
 * @param native The plugin's native bridge.
 * @returns The cards, or `undefined` when Discord's message classes are missing.
 */
export function startCards({ objc }: NativePluginBridge): Cards | undefined {
	if (
		!ensureClasses(PLUGIN_NAME, objc, [messageTextViewClass(objc), 'DCDMessageTableViewCell'])
	) {
		return;
	}

	return {
		feature: () => startRenderer(objc),
		progress: cardProgress,
		misplaced: misplacedCards,
	};
}

export default startCards;
