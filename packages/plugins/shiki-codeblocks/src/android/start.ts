import type { NativePluginBridge } from '@unbound-app/api/native';

import { createNativeCards } from '~/android/native-cards';
import { createAndroidCards } from '~/android/cards';
import type { Cards } from '~/types';

/**
 * @description Draws code cards in Discord's native Android message text, or over it when the text cannot be rewritten.
 * @param native The plugin's native bridge.
 * @returns The cards, or `undefined` when neither way is available.
 */
export function startCards(native: NativePluginBridge): Cards | undefined {
	const cards = createNativeCards(native) ?? createAndroidCards(native);

	if (!cards) return;

	return { feature: () => cards.dispose, progress: cards.progress, misplaced: async () => [] };
}

export default startCards;
