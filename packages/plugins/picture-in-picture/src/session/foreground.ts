import { AppState } from 'react-native';

import type { HoldStore } from '~/session/hold';

/**
 * @description Lets held players follow Discord's own pause state again once Discord is back in the foreground.
 * @template Target The player a hold belongs to.
 * @param holds The hold store.
 * @returns A function that stops listening and releases every hold.
 */
export function releaseHoldsInForeground<Target>(holds: HoldStore<Target>): () => void {
	const subscription = AppState.addEventListener('change', (state) => {
		if (state === 'active') holds.releaseAll();
	});

	return () => {
		subscription.remove();
		holds.releaseAll();
	};
}
