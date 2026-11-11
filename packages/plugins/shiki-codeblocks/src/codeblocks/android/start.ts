import type { NativePluginBridge } from '@unbound-app/api/native';

import { createAndroidCards } from '~/codeblocks/android/cards';
import type { Cards } from '~/types';

/**
 * @description Draws code cards in Discord's native Android message text.
 * @param native The plugin's native bridge.
 * @returns The cards, or `undefined` when the card surface or the loader's text rewrites are unavailable.
 */
export function startCards(native: NativePluginBridge): Cards | undefined {
	const cards = createAndroidCards(native);

	if (!cards) return;

	return { feature: () => cards.dispose, progress: cards.progress, misplaced: async () => [] };
}

export default startCards;
