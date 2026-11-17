import type { NativeBridge } from '@unbound-app/api/native';

import {
	installPillControls,
	playVoiceMessage,
	removePillControls,
	showPillSpeed,
} from '~/native/ios/pill-worklets';

/**
 * @description Puts speed and download buttons inside voice message pills on iOS.
 * @param native The plugin's native bridge.
 * @param speed Reads the chosen speed.
 * @param onAction Runs with a tapped button's action and its message id.
 * @returns `refresh`, which shows a changed speed, `play`, which starts a voice message on screen, and `dispose`, which removes the hooks and buttons.
 */
export function pillIOS(
	native: NativeBridge,
	speed: () => number,
	onAction: (action: 'speed' | 'download', messageId: string) => void,
) {
	const scope = native.ui.createScope();

	native.ui.run(installPillControls, scope, speed(), native.ui.callback(onAction));

	return {
		refresh() {
			native.ui.run(showPillSpeed, scope, speed());
		},
		play(messageId: string): Promise<boolean> {
			return native.ui.call(playVoiceMessage, scope, messageId);
		},
		dispose() {
			native.ui.run(removePillControls, scope);
			scope.dispose();
		},
	};
}
