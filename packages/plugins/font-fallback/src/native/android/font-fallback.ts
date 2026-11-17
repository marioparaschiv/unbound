import type { NativeBridge } from '@unbound-app/api/native';

import type { ScriptChoices } from '~/lib/choices';
import type { FontFallbackSession } from '~/native/font-fallback';
import {
	installFontFallback,
	restoreFontFallback,
	setFontFallback,
} from '~/native/android/worklets';
import { facePaths } from '~/native/face-paths';

/**
 * @description Draws each script in message text with its font on Android.
 * @param native The plugin's native bridge.
 * @param choices The face picked for each script.
 * @returns `update`, which changes the fonts, and `dispose`, which removes them.
 */
export function fontFallbackAndroid(
	native: NativeBridge,
	choices: ScriptChoices,
): FontFallbackSession {
	const scope = native.ui.createScope();

	native.ui.run(installFontFallback, scope, facePaths(choices));

	return {
		async update(next) {
			native.ui.run(setFontFallback, scope, facePaths(next));
		},
		dispose() {
			native.ui.run(restoreFontFallback, scope);
			scope.dispose();
		},
	};
}
