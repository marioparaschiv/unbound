import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { transliterateAndroid as android } from './android';
import { transliterateIOS as ios } from './ios';

const transliterateOnPlatform = native.definePlatform({ ios, android });

/**
 * @description Runs an ICU transform, such as `Han-Latin` or `Any-Latin`, over text with the platform's own ICU.
 * @param bridge The plugin's native bridge.
 * @param text The text.
 * @param transform The ICU transform id.
 * @returns The transformed text, or `undefined` when the platform cannot run it.
 */
export function transliterate(
	bridge: NativeBridge,
	text: string,
	transform: string,
): Promise<string | undefined> {
	return transliterateOnPlatform(bridge, text, transform) ?? Promise.resolve(undefined);
}

export default transliterate;
