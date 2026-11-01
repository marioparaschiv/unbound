import type { NativePluginBridge } from '@unbound-app/api/native';
import { AppState } from 'react-native';

import { rotateScreen } from '~/rotation/platform';

const UPSIDE_DOWN = 180;

/**
 * @description Turns Discord upside down by rotating its root native view, so the whole screen turns,
 * dialogs and sheets included, and touches and scrolling turn with it. It rotates again whenever Discord
 * returns to the foreground, in case the system rebuilt the view while it was away.
 * @param native The plugin's native bridge.
 * @param report Called with an error when the rotation fails.
 * @returns A function that turns Discord the right way up again.
 */
export function startRotation(
	native: NativePluginBridge,
	report: (error: unknown) => void,
): () => void {
	const rotate = (degrees: number) => void rotateScreen(native, degrees).catch(report);
	const subscription = AppState.addEventListener('change', (state) => {
		if (state === 'active') rotate(UPSIDE_DOWN);
	});

	rotate(UPSIDE_DOWN);

	return () => {
		subscription.remove();
		rotate(0);
	};
}
