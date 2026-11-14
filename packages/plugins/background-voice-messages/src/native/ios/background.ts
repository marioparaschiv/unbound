import type { NativeBridge } from '@unbound-app/api/native';
import { metro } from '@unbound-app/api';

import { installBackgroundPlayback, restoreSession, restoreWhenIdle } from '~/native/ios/worklets';

/**
 * @description Keeps audio attachments playing in the background on iOS, and tidies the audio session each time Discord comes back.
 * @param native The plugin's native bridge.
 * @returns `dispose`, which puts the audio session back and removes the hook.
 */
export function backgroundPlaybackIOS(native: NativeBridge) {
	const scope = native.ui.createScope();
	const { AppState } = metro.common.ReactNative;

	native.ui.run(installBackgroundPlayback, scope);

	const subscription = AppState.addEventListener('change', (status: string) => {
		if (status === 'active') native.ui.run(restoreWhenIdle, scope);
	});

	return {
		dispose() {
			subscription.remove();
			native.ui.run(restoreSession, scope);
			scope.dispose();
		},
	};
}
