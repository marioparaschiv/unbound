import { messageIdField } from '@unbound-plugins/shared/native/android/discord-views';
import type { NativeBridge } from '@unbound-app/api/native';

import {
	installPillControls,
	playVoiceMessage,
	removePillControls,
	showPillSpeed,
} from '~/native/android/pill-worklets';

/**
 * @description Puts speed and download buttons inside voice message pills on Android.
 * @param native The plugin's native bridge.
 * @param speed Reads the chosen speed.
 * @param onAction Runs with a clicked button's action and its message id.
 * @returns `refresh`, which shows a changed speed, `play`, which starts a voice message on screen, and `dispose`, which removes the hook and buttons.
 */
export function pillAndroid(
	native: NativeBridge,
	speed: () => number,
	onAction: (action: 'speed' | 'download', messageId: string) => void,
) {
	const scope = native.ui.createScope();
	const idField = messageIdField(native.java);

	native.ui.run(installPillControls, scope, speed(), idField, native.ui.callback(onAction));

	return {
		refresh() {
			native.ui.run(showPillSpeed, scope, speed());
		},
		play(messageId: string): Promise<boolean> {
			return native.ui.call(playVoiceMessage, scope, messageId, idField);
		},
		dispose() {
			native.ui.run(removePillControls, scope);
			scope.dispose();
		},
	};
}
