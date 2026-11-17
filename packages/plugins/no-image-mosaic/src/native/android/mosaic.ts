import type { NativeBridge } from '@unbound-app/api/native';

import { mosaicShape } from '~/native/android/mosaic-shape';
import { installMosaicHook, restoreMosaics } from '~/native/android/worklets';

/**
 * @description Stacks media mosaics one image per row on Android, once the tile classes are found.
 * @param native The plugin's native bridge.
 * @returns A function that lays every mosaic out as Discord's grid again and removes the hooks.
 */
export function stackAndroid(native: NativeBridge) {
	const scope = native.ui.createScope();
	let stopped = false;
	const installed = mosaicShape(native.java)
		.then((shape) => {
			if (!shape) {
				logger.warn('Found no media mosaic layout; images keep Discord’s grid.');

				return;
			}

			if (!stopped) native.ui.run(installMosaicHook, scope, shape);
		})
		.catch((error: unknown) => logger.error('Failed to find the media mosaic layout:', error));

	return async () => {
		stopped = true;
		await installed;
		await native.ui
			.call(restoreMosaics)
			.catch((error: unknown) => logger.error('Failed to restore the media mosaics:', error));
		scope.dispose();
	};
}
