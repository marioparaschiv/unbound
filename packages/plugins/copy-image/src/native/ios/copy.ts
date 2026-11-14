import { metro } from '@unbound-app/api';

type Clipboard = { setImage(base64: string): void };

const Clipboard: Clipboard | undefined = metro.findByProps('setImage', 'getString', { lazy: true });

/**
 * @description Puts a PNG on the iOS clipboard through React Native's clipboard module, which stores it as an image.
 * @param _native The plugin's native bridge, unused on iOS.
 * @param base64 The PNG's bytes, as base64.
 * @returns Whether the image was copied.
 */
export async function copyOnIOS(_native: unknown, base64: string): Promise<boolean> {
	if (!Clipboard) return false;

	await Clipboard.setImage(base64);

	return true;
}

export default copyOnIOS;
