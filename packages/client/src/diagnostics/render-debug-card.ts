import { currentPlatform } from '~/native/platform';
import { getNativeBridge } from '~/native/bridge';

import type { DebugCard } from './debug-card';

import { renderDebugCardAndroid } from './render-debug-card-android';
import { renderDebugCardIos } from './render-debug-card-ios';

/**
 * @description Renders the debug card to a PNG with the platform's own drawing APIs.
 * @param card The laid-out card.
 * @param path The absolute file path to write.
 * @returns Whether the PNG was written; `false` when the native bridge cannot draw on this platform.
 */
export function renderDebugCard(card: DebugCard, path: string): boolean {
	const bridge = getNativeBridge();
	const platform = currentPlatform();

	if (platform === 'android' && bridge?.java) {
		renderDebugCardAndroid(bridge.java, card, path);

		return true;
	}

	if (platform === 'ios' && bridge?.objc && bridge.ffi) {
		renderDebugCardIos({ objc: bridge.objc, ffi: bridge.ffi }, card, path);

		return true;
	}

	return false;
}

export default renderDebugCard;
