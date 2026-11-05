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
export async function startRotation(
	native: NativePluginBridge,
	report: (error: unknown) => void,
): Promise<() => Promise<void>> {
	let stopped = false;
	let pending = Promise.resolve();
	const rotate = (degrees: number) => {
		const operation = pending
			.then(async () => {
				if (stopped && degrees !== 0) return;

				await rotateScreen(native, degrees);
			})
			.catch(report);

		pending = operation;

		return operation;
	};
	const subscription = AppState.addEventListener('change', (state) => {
		if (state === 'active') void rotate(UPSIDE_DOWN);
	});

	await rotate(UPSIDE_DOWN);

	return async () => {
		stopped = true;
		subscription.remove();
		await pending;
		await rotate(0);
	};
}
