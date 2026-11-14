import type { NativeBridge } from '@unbound-app/api/native';

import { installSpeedHook, setSpeed } from '~/native/android/speed-worklets';

/**
 * @description Plays voice messages at a chosen speed on Android.
 * @param native The plugin's native bridge.
 * @param speed Reads the chosen speed.
 * @returns `refresh`, which applies a changed speed, and `dispose`, which removes the hook.
 */
export function speedAndroid(native: NativeBridge, speed: () => number) {
	const scope = native.ui.createScope();

	native.ui.run(installSpeedHook, scope, speed());

	return {
		refresh() {
			native.ui.run(setSpeed, speed());
		},
		dispose() {
			scope.dispose();
		},
	};
}
