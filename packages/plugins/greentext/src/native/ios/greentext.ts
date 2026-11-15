import { MESSAGE_TEXT_VIEW_CLASSES } from '@unbound-plugins/shared/native/ios/text-attachments';
import type { NativeBridge } from '@unbound-app/api/native';

import type { GreentextSession } from '~/native/greentext';

import { installGreentext, restoreGreentext, setGreentextColor } from '~/native/ios/worklets';

/**
 * @description Colors greentext in message text on iOS.
 * @param native The plugin's native bridge.
 * @param hex The color to start with, as `#rrggbb`.
 * @returns `update`, which changes the color, and `dispose`, which puts the original text back.
 */
export function greentextIOS(native: NativeBridge, hex: string): GreentextSession {
	const scope = native.ui.createScope();

	native.ui.run(installGreentext, scope, [...MESSAGE_TEXT_VIEW_CLASSES], hex);

	return {
		update(next: string) {
			native.ui.run(setGreentextColor, next);
		},
		dispose() {
			native.ui.run(restoreGreentext);
		},
	};
}

export default greentextIOS;
