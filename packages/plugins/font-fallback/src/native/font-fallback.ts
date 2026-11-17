import { native } from '@unbound-app/api';

import type { ScriptChoices } from '~/lib/choices';
import { fontFallbackAndroid as android } from '~/native/android/font-fallback';
import { fontFallbackIOS as ios } from '~/native/ios/font-fallback';

export type FontFallbackSession = {
	update(choices: ScriptChoices): Promise<void>;
	dispose(): void;
};

/**
 * @description Draws each script in message text with the installed font picked for it.
 */
export const fontFallback = native.definePlatform({ ios, android });
