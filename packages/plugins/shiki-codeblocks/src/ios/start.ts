import { messageTextViewClass } from '@unbound-plugins/shared/native/ios/text-attachments';
import { installReuseCleanup } from '@unbound-plugins/shared/native/ios/ui-reuse-cleanup';
import ensureClasses from '@unbound-plugins/shared/native/ios/ensure-classes';
import type { NativePluginBridge } from '@unbound-app/api/native';

import { cardProgress, misplacedCards, startRenderer } from '~/ios/renderer';
import { PLUGIN_NAME } from '~/constants';
import { CARD_TAG } from '~/ios/code-host';
import type { Cards } from '~/types';

/**
 * @description Draws code cards in Discord's native iOS message cells.
 * @param native The plugin's native bridge.
 * @returns The cards, or `undefined` when Discord's message classes are missing.
 */
export function startCards({ objc, ui }: NativePluginBridge): Cards | undefined {
	if (
		!ensureClasses(PLUGIN_NAME, objc, [messageTextViewClass(objc), 'DCDMessageTableViewCell'])
	) {
		return;
	}

	return {
		feature: () => {
			const scope = ui.createScope();

			ui.run(installReuseCleanup, scope, {
				cellClass: 'DCDMessageTableViewCell',
				tag: CARD_TAG,
				label: PLUGIN_NAME,
			});

			const stop = startRenderer(objc);

			return () => {
				scope.dispose();
				stop();
			};
		},
		progress: cardProgress,
		misplaced: misplacedCards,
	};
}

export default startCards;
