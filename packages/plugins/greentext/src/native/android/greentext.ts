import type { NativeBridge } from '@unbound-app/api/native';

import type { GreentextSession } from '~/native/greentext';

import { installGreentext, restoreGreentext, setGreentextColor } from '~/native/android/worklets';

/**
 * @description Colors greentext in message text on Android.
 * @param native The plugin's native bridge.
 * @param hex The color to start with, as `#rrggbb`.
 * @returns `update`, which changes the color, and `dispose`, which removes the colors.
 */
export function greentextAndroid(native: NativeBridge, hex: string): GreentextSession {
	const scope = native.ui.createScope();

	native.ui.run(installGreentext, scope, hex);

	return {
		update(next: string) {
			native.ui.run(setGreentextColor, scope, next);
		},
		dispose() {
			native.ui.run(restoreGreentext, scope);
		},
	};
}

export default greentextAndroid;
