import type { NativeBridge } from '@unbound-app/api/native';

import type { MessageTextSize } from '~/native/text-size';

import {
	installMessageTextSize,
	restoreMessageTextSize,
	setMessageTextScale,
} from '~/native/android/worklets';

/**
 * @description Scales message text on Android.
 * @param native The plugin's native bridge.
 * @param scale The factor to start with.
 * @returns `update`, which changes the factor, and `dispose`, which gives messages their size back.
 */
export function messageTextSizeAndroid(native: NativeBridge, scale: number): MessageTextSize {
	const scope = native.ui.createScope();

	native.ui.run(installMessageTextSize, scope, scale);

	return {
		update(next: number) {
			native.ui.run(setMessageTextScale, scope, next);
		},
		dispose() {
			native.ui.run(restoreMessageTextSize, scope);
		},
	};
}

export default messageTextSizeAndroid;
