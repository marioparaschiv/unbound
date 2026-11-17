import type { NativeBridge } from '@unbound-app/api/native';

import { installControllerHook } from '~/native/android/worklets';

/**
 * @description Listens to a game controller on Android.
 * @param native The plugin's native bridge.
 * @param onPress Runs with each pressed key code.
 * @returns A function that removes the hook.
 */
export function listenAndroid(native: NativeBridge, onPress: (code: number) => void) {
	const scope = native.ui.createScope();

	native.ui.run(installControllerHook, scope, native.ui.callback(onPress));

	return () => scope.dispose();
}
