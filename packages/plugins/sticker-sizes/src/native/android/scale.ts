import type { NativeBridge } from '@unbound-app/api/native';

import { installStickerScale, setStickerScale } from '~/native/android/worklets';

/**
 * @description Shows stickers at a chosen scale on Android.
 * @param native The plugin's native bridge.
 * @param scale Reads the chosen factor.
 * @returns `refresh`, which applies a changed factor, and `dispose`, which removes the hook.
 */
export function scaleAndroid(native: NativeBridge, scale: () => number) {
	const scope = native.ui.createScope();

	native.ui.run(installStickerScale, scope, scale());

	return {
		refresh() {
			native.ui.run(setStickerScale, scale());
		},
		dispose() {
			scope.dispose();
		},
	};
}
