import type { NativeBridge } from '@unbound-app/api/native';

import type { PrivacyScreen } from '~/native/privacy-screen';

import { setSecureWindow } from '~/native/android/worklets';

/**
 * @description Marks Discord's window secure on Android until the returned function is called.
 * @param bridge The plugin's native bridge.
 * @returns Clears the flag, and tests it.
 */
export function privacyAndroid(bridge: NativeBridge): PrivacyScreen {
	const scope = bridge.ui.createScope();
	const secured = bridge.ui.call(setSecureWindow, scope, true).catch((error: unknown) => {
		logger.error('Failed to secure the window:', error);

		return false;
	});

	return {
		stop() {
			bridge.ui.call(setSecureWindow, scope, false).finally(() => scope.dispose());
		},
		async test() {
			return (await secured)
				? { ok: true, detail: 'the window is secure' }
				: { ok: false, detail: 'no window to secure' };
		},
	};
}

export default privacyAndroid;
