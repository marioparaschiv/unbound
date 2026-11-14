import { messageIdField } from '@unbound-plugins/shared/native/android/discord-views';
import type { NativeBridge } from '@unbound-app/api/native';

import {
	installPillControls,
	removePillControls,
	showPillSpeed,
} from '~/native/android/pill-worklets';

/**
 * @description Puts speed and download buttons inside voice message pills on Android.
 * @param native The plugin's native bridge.
 * @param speed Reads the chosen speed.
 * @param onAction Runs with a clicked button's action and its message id.
 * @returns `refresh`, which shows a changed speed, and `dispose`, which removes the hook and buttons.
 */
export function pillAndroid(
	native: NativeBridge,
	speed: () => number,
	onAction: (action: 'speed' | 'download', messageId: string) => void,
) {
	const scope = native.ui.createScope();

	native.ui.run(
		installPillControls,
		scope,
		speed(),
		messageIdField(native.java),
		native.ui.callback(onAction),
	);

	return {
		refresh() {
			native.ui.run(showPillSpeed, scope, speed());
		},
		dispose() {
			native.ui.run(removePillControls, scope);
			scope.dispose();
		},
	};
}
