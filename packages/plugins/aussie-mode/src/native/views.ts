import type { NativeBridge } from '@unbound-app/api/native';
import { AppState } from 'react-native';
import { native } from '@unbound-app/api';

import { rotateScreen as android } from '~/native/views-android';
import { rotateScreen as ios } from '~/native/views-ios';
import { isAussieDevice } from '~/lib/locale';

const UPSIDE_DOWN = 180;

const rotateScreen = native.definePlatform({ ios, android });

let turnBack: (() => Promise<void>) | undefined;

function reportRotationFailure(error: unknown): void {
	logger.error('Failed to rotate the screen:', error);
}

async function startRotation(bridge: NativeBridge): Promise<() => Promise<void>> {
	let stopped = false;
	let pending = Promise.resolve();
	const rotate = (degrees: number) => {
		const operation = pending
			.then(async () => {
				if (stopped && degrees !== 0) return;

				await rotateScreen(bridge, degrees);
			})
			.catch(reportRotationFailure);

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

/**
 * @description Turns Discord upside down on an Australian device by rotating its root native view, so the whole screen
 * turns, dialogs and sheets included, and touches and scrolling turn with it. It rotates again whenever Discord
 * returns to the foreground, in case the system rebuilt the view while it was away.
 * @param bridge The plugin's native bridge.
 * @returns A promise that settles after the first rotation.
 */
export async function turnScreenOver(bridge: NativeBridge): Promise<void> {
	if (!isAussieDevice()) return;

	turnBack = await startRotation(bridge);
}

/**
 * @description Turns Discord the right way up again and stops listening for the foreground, which the Addon scope
 * does not see.
 * @returns A promise that settles once the screen is upright.
 */
export async function turnScreenBack(): Promise<void> {
	const current = turnBack;

	turnBack = undefined;
	await current?.();
}
